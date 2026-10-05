import { config } from '../config';
import { EXERCISES, findExercise } from '../data/exercises';
import { MUSCLES, type EquipmentId, type Exercise, type Muscle } from '../types';

export type Rng = () => number;

/** Everything dealing needs to know about the gym and the lifter right now. */
export interface DealContext {
  equipment: readonly EquipmentId[];
  /** Hard sets per muscle this session (filler cards favor the least trained). */
  trained: Record<Muscle, number>;
  /** Cards whose muscles are at the fatigue cap are never dealt. */
  isLocked?: (id: string) => boolean;
  /** In a fight, only cards that can hit an enemy are dealt. */
  playable?: (id: string) => boolean;
  /** Muscles to favor when dealing filler cards (the current enemies' weaknesses). */
  wanted?: Muscle[];
  rng: Rng;
}

export interface HandState {
  hand: string[];
  drawPile: string[];
  discard: string[];
  swappedOut: string[];
}

export function isAvailable(ex: Exercise, equipment: readonly EquipmentId[]): boolean {
  return ex.equipment.every((e) => equipment.includes(e));
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How interchangeable `b` is for `a`. 0 means no shared primary muscle (not a valid swap). */
export function similarity(a: Exercise, b: Exercise): number {
  const sharedPrimary = a.primaryMuscles.filter((m) => b.primaryMuscles.includes(m)).length;
  if (sharedPrimary === 0) return 0;
  const sharedSecondary = a.secondaryMuscles.filter((m) => b.secondaryMuscles.includes(m)).length;
  return sharedPrimary * 3 + sharedSecondary + (a.isCompound === b.isCompound ? 2 : 0);
}

/** Best available stand-ins for an exercise, most similar first (random among ties). */
export function alternativesFor(
  id: string,
  equipment: readonly EquipmentId[],
  exclude: readonly string[],
  rng: Rng,
): Exercise[] {
  const ex = findExercise(id);
  if (!ex) return [];
  const scored = shuffle(EXERCISES, rng)
    .filter((c) => c.id !== id && !exclude.includes(c.id) && isAvailable(c, equipment))
    .map((c) => ({ c, s: similarity(ex, c) }))
    .filter((x) => x.s > 0);
  // Stable sort keeps the shuffled order among ties.
  scored.sort((x, y) => y.s - x.s);
  return scored.map((x) => x.c);
}

/** Deck cards the gym can't support are replaced with their closest available alternative. */
export function resolveDeck(deck: readonly string[], equipment: readonly EquipmentId[], rng: Rng): string[] {
  const out: string[] = [];
  for (const id of deck) {
    const ex = findExercise(id);
    if (!ex) continue;
    if (isAvailable(ex, equipment)) {
      if (!out.includes(id)) out.push(id);
      continue;
    }
    const alt = alternativesFor(id, equipment, [...out, ...deck], rng)[0];
    if (alt) out.push(alt.id);
  }
  return out;
}

export function emptyTrained(): Record<Muscle, number> {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
}

function dealable(id: string, state: HandState, ctx: DealContext): boolean {
  const ex = findExercise(id);
  return (
    !!ex &&
    isAvailable(ex, ctx.equipment) &&
    !state.hand.includes(id) &&
    !state.swappedOut.includes(id) &&
    !ctx.isLocked?.(id) &&
    (ctx.playable?.(id) ?? true)
  );
}

/** Cards that are fine in general but can't be dealt right now; they wait in the pile. */
function heldBack(id: string, ctx: DealContext): boolean {
  return !!ctx.isLocked?.(id) || (ctx.playable ? !ctx.playable(id) : false);
}

export function startHand(deck: readonly string[], ctx: DealContext): HandState {
  const pile = shuffle(resolveDeck(deck, ctx.equipment, ctx.rng), ctx.rng);
  return fillHand({ hand: [], drawPile: pile, discard: [], swappedOut: [] }, ctx);
}

/**
 * When the deck runs dry, deal a card for the least-trained muscle this session
 * so the session drifts toward full-body coverage without the user browsing a list.
 */
export function fillerCard(state: HandState, ctx: DealContext): string | undefined {
  const used = new Set([...state.hand, ...state.discard, ...state.swappedOut]);
  const candidates = EXERCISES.filter((e) => !used.has(e.id) && dealable(e.id, state, ctx));
  if (candidates.length === 0) return undefined;
  const wanted = (m: Muscle) => (ctx.wanted?.includes(m) ? 0 : 1);
  const muscles = shuffle(MUSCLES, ctx.rng)
    .filter((m) => candidates.some((e) => e.primaryMuscles.includes(m)))
    .sort((a, b) => wanted(a) - wanted(b) || ctx.trained[a] - ctx.trained[b]);
  const target = muscles[0];
  if (!target) return undefined;
  const pool = candidates.filter((e) => e.primaryMuscles.includes(target));
  return pool[Math.floor(ctx.rng() * pool.length)]?.id;
}

function drawOne(state: HandState, ctx: DealContext): HandState | undefined {
  const drawPile = [...state.drawPile];
  const skipped: string[] = [];
  while (drawPile.length > 0) {
    const id = drawPile.shift()!;
    if (dealable(id, state, ctx)) return { ...state, drawPile: [...drawPile, ...skipped], hand: [...state.hand, id] };
    // Locked or off-target cards stay in the pile in case they become playable later.
    if (heldBack(id, ctx)) skipped.push(id);
  }
  const rest = { ...state, drawPile: skipped };
  const filler = fillerCard(rest, ctx);
  if (filler) return { ...rest, hand: [...state.hand, filler] };
  // Everything has been played: reshuffle the discard pile.
  const reshuffled = shuffle(
    state.discard.filter((id) => dealable(id, state, ctx)),
    ctx.rng,
  );
  if (reshuffled.length === 0) return undefined;
  const [id, ...others] = reshuffled;
  return {
    ...rest,
    drawPile: [...others, ...skipped],
    discard: state.discard.filter((d) => !reshuffled.includes(d)),
    hand: [...state.hand, id],
  };
}

export function fillHand(state: HandState, ctx: DealContext): HandState {
  let s = state;
  while (s.hand.length < config.deck.handSize) {
    const next = drawOne(s, ctx);
    if (!next) break;
    s = next;
  }
  return s;
}

/** The card was played out (or is locked and discarded): discard it and draw a replacement. */
export function finishCard(state: HandState, id: string, ctx: DealContext): HandState {
  if (!state.hand.includes(id)) return state;
  const s: HandState = {
    ...state,
    hand: state.hand.filter((h) => h !== id),
    discard: [...state.discard, id],
  };
  return fillHand(s, ctx);
}

/** "Machine taken": replace a card in place with the most similar available exercise. */
export function swapCard(state: HandState, id: string, ctx: DealContext): HandState | undefined {
  const idx = state.hand.indexOf(id);
  if (idx < 0) return undefined;
  const exclude = [...state.hand, ...state.swappedOut, ...state.discard];
  const alt = alternativesFor(id, ctx.equipment, exclude, ctx.rng).find((e) => !ctx.isLocked?.(e.id));
  if (!alt) return undefined;
  const hand = [...state.hand];
  hand[idx] = alt.id;
  return { ...state, hand, swappedOut: [...state.swappedOut, id] };
}

/**
 * At the start of a fight (and whenever enemies or fatigue change), cards that can't hit any
 * enemy, or are locked by fatigue, go back to the draw pile. The hand is refilled with cards that
 * hit a weakness with their primary muscle (`ctx.playable`), and only if those run out with cards
 * that graze one (`loose`), so the hand never holds dead cards.
 */
export function refreshForFight(
  state: HandState,
  ctx: DealContext,
  keep?: string,
  loose?: (id: string) => boolean,
): HandState {
  const strong = (id: string) => (ctx.playable?.(id) ?? true) && !ctx.isLocked?.(id);
  const out = state.hand.filter((id) => id !== keep && !strong(id));
  let s: HandState = {
    ...state,
    hand: state.hand.filter((id) => !out.includes(id)),
    drawPile: [...state.drawPile, ...out],
  };
  s = fillHand(s, ctx);
  if (loose && s.hand.length < config.deck.handSize) s = fillHand(s, { ...ctx, playable: loose });
  return s;
}

/** A newly won run card goes to the top of the draw pile. */
export function addRunCard(state: HandState, id: string): HandState {
  if (state.hand.includes(id) || state.drawPile.includes(id)) return state;
  return { ...state, drawPile: [id, ...state.drawPile] };
}

/** Put a specific card in hand (e.g. the boss's weak-point lift), bumping the last card to the pile. */
export function ensureInHand(state: HandState, id: string): HandState {
  if (state.hand.includes(id)) return state;
  const rest = state.hand.length >= config.deck.handSize ? state.hand.slice(0, config.deck.handSize - 1) : state.hand;
  const bumped = state.hand.filter((h) => !rest.includes(h));
  return {
    hand: [id, ...rest],
    drawPile: [...bumped, ...state.drawPile.filter((d) => d !== id)],
    discard: state.discard.filter((d) => d !== id),
    swappedOut: state.swappedOut,
  };
}

import { config } from '../config';
import { EXERCISES, findExercise } from '../data/exercises';
import { MUSCLES, type EquipmentId, type Exercise, type Muscle } from '../types';

export type Rng = () => number;

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

export function startHand(deck: readonly string[], equipment: readonly EquipmentId[], rng: Rng): HandState {
  const pile = shuffle(resolveDeck(deck, equipment, rng), rng);
  const state: HandState = { hand: [], drawPile: pile, discard: [], swappedOut: [] };
  return fillHand(state, equipment, emptyTrained(), rng);
}

function emptyTrained(): Record<Muscle, number> {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
}

/**
 * When the deck runs dry, deal a card for the least-trained muscle this session
 * so the session drifts toward full-body coverage without the user browsing a list.
 */
export function fillerCard(
  state: HandState,
  equipment: readonly EquipmentId[],
  trained: Record<Muscle, number>,
  rng: Rng,
): string | undefined {
  const used = new Set([...state.hand, ...state.discard, ...state.swappedOut]);
  const candidates = EXERCISES.filter((e) => !used.has(e.id) && isAvailable(e, equipment));
  if (candidates.length === 0) return undefined;
  const muscles = shuffle(MUSCLES, rng)
    .filter((m) => candidates.some((e) => e.primaryMuscles.includes(m)))
    .sort((a, b) => trained[a] - trained[b]);
  const target = muscles[0];
  if (!target) return undefined;
  const pool = candidates.filter((e) => e.primaryMuscles.includes(target));
  return pool[Math.floor(rng() * pool.length)]?.id;
}

function drawOne(
  state: HandState,
  equipment: readonly EquipmentId[],
  trained: Record<Muscle, number>,
  rng: Rng,
): HandState | undefined {
  const drawPile = [...state.drawPile];
  while (drawPile.length > 0) {
    const id = drawPile.shift()!;
    const ex = findExercise(id);
    if (ex && isAvailable(ex, equipment) && !state.hand.includes(id) && !state.swappedOut.includes(id)) {
      return { ...state, drawPile, hand: [...state.hand, id] };
    }
  }
  const filler = fillerCard({ ...state, drawPile }, equipment, trained, rng);
  if (filler) return { ...state, drawPile, hand: [...state.hand, filler] };
  // Everything has been played: reshuffle the discard pile.
  const reshuffled = shuffle(
    state.discard.filter((id) => !state.hand.includes(id)),
    rng,
  );
  if (reshuffled.length === 0) return undefined;
  const [id, ...rest] = reshuffled;
  return { ...state, drawPile: rest, discard: [], hand: [...state.hand, id] };
}

export function fillHand(
  state: HandState,
  equipment: readonly EquipmentId[],
  trained: Record<Muscle, number>,
  rng: Rng,
): HandState {
  let s = state;
  while (s.hand.length < config.deck.handSize) {
    const next = drawOne(s, equipment, trained, rng);
    if (!next) break;
    s = next;
  }
  return s;
}

/** The card was played out: discard it and draw a replacement. */
export function finishCard(
  state: HandState,
  id: string,
  equipment: readonly EquipmentId[],
  trained: Record<Muscle, number>,
  rng: Rng,
): HandState {
  if (!state.hand.includes(id)) return state;
  const s: HandState = {
    ...state,
    hand: state.hand.filter((h) => h !== id),
    discard: [...state.discard, id],
  };
  return fillHand(s, equipment, trained, rng);
}

/** "Machine taken": replace a card in place with the most similar available exercise. */
export function swapCard(
  state: HandState,
  id: string,
  equipment: readonly EquipmentId[],
  rng: Rng,
): HandState | undefined {
  const idx = state.hand.indexOf(id);
  if (idx < 0) return undefined;
  const exclude = [...state.hand, ...state.swappedOut, ...state.discard];
  const alt = alternativesFor(id, equipment, exclude, rng)[0];
  if (!alt) return undefined;
  const hand = [...state.hand];
  hand[idx] = alt.id;
  return { ...state, hand, swappedOut: [...state.swappedOut, id] };
}

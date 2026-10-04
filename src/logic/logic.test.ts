import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { ALL_EQUIPMENT } from '../data/equipment';
import { getExercise } from '../data/exercises';
import type { EquipmentId, LoggedSet } from '../types';
import { alternativesFor, emptyTrained, finishCard, resolveDeck, startHand, swapCard, type DealContext } from './hand';
import { prefillFor } from './prefill';
import { restPhase } from './rest';
import { fromKg, toKg } from './units';
import { emptyMuscleMap, setsByMuscle } from './volume';

/** Deterministic PRNG (mulberry32) so tests are reproducible. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ctx = (rng: () => number, over: Partial<DealContext> = {}): DealContext => ({
  equipment: ALL_EQUIPMENT, trained: emptyTrained(), rng, ...over,
});

const set = (exerciseId: string, over: Partial<LoggedSet> = {}): LoggedSet => ({
  sessionId: 1, exerciseId, weightKg: 60, reps: 8, isWarmup: false, loggedAt: 0, ...over,
});

describe('units', () => {
  it('round-trips pounds through kg storage', () => {
    for (const lb of [45, 135, 165, 167.5, 315]) expect(fromKg(toKg(lb, 'lb'), 'lb')).toBe(lb);
    expect(fromKg(100, 'kg')).toBe(100);
  });
});

describe('setsByMuscle', () => {
  it('counts primary 1.0, secondary 0.5 and ignores warm-ups', () => {
    const v = setsByMuscle([set('bench_press'), set('bench_press'), set('bench_press', { isWarmup: true })]);
    expect(v.chest).toBe(2);
    expect(v.triceps).toBe(1);
    expect(v.shoulders).toBe(1);
    expect(v.quads).toBe(0);
  });
});

describe('prefill', () => {
  it('uses the most recent working set', () => {
    const p = prefillFor(getExercise('bench_press'), [
      set('bench_press', { weightKg: 50, reps: 10, loggedAt: 1 }),
      set('bench_press', { weightKg: 70, reps: 5, loggedAt: 3 }),
      set('bench_press', { weightKg: 20, reps: 12, loggedAt: 4, isWarmup: true }),
    ], 'kg');
    expect(p).toEqual({ weightKg: 70, reps: 5 });
  });

  it('falls back to equipment defaults for a never-logged exercise', () => {
    expect(prefillFor(getExercise('bench_press'), [], 'kg')).toEqual({
      weightKg: config.logging.defaultStart.kg.barbell,
      reps: config.logging.defaultReps,
    });
    // An empty bar in pounds shows as exactly 45 lb, not a converted 44.1.
    expect(fromKg(prefillFor(getExercise('bench_press'), [], 'lb').weightKg, 'lb')).toBe(45);
    expect(prefillFor(getExercise('pull_up'), [], 'lb').weightKg).toBe(0);
  });
});

describe('rest phases', () => {
  it('follows compound and isolation windows with grace', () => {
    const c = { isCompound: true };
    expect(restPhase(c, 100)).toBe('resting');
    expect(restPhase(c, 180)).toBe('ready');
    expect(restPhase(c, 300)).toBe('ready');
    expect(restPhase(c, 330)).toBe('late');
    expect(restPhase(c, 361)).toBe('overdue');
    expect(restPhase({ isCompound: false }, 95)).toBe('ready');
  });
});

describe('hand', () => {
  it('deals a full hand from the deck', () => {
    const s = startHand(config.deck.starter, ctx(seeded(1)));
    expect(s.hand).toHaveLength(config.deck.handSize);
    expect(s.drawPile).toHaveLength(config.deck.starter.length - config.deck.handSize);
    for (const id of s.hand) expect(config.deck.starter).toContain(id);
  });

  it('never deals cards the gym cannot support', () => {
    const noBarbell = ALL_EQUIPMENT.filter((e) => e !== 'barbell');
    const deck = resolveDeck(config.deck.starter, noBarbell, seeded(2));
    for (const id of deck) expect(getExercise(id).equipment).not.toContain('barbell');
    // Squat replaced by another quad exercise, bench by another chest exercise.
    expect(deck.some((id) => getExercise(id).primaryMuscles.includes('quads'))).toBe(true);
    expect(deck.some((id) => getExercise(id).primaryMuscles.includes('chest'))).toBe(true);
  });

  it('swap replaces a card in place with a same-muscle alternative and never offers it back', () => {
    const s = startHand(config.deck.starter, ctx(seeded(3)));
    const target = s.hand[0];
    const swapped = swapCard(s, target, ctx(seeded(4)))!;
    const alt = getExercise(swapped.hand[0]);
    expect(alt.id).not.toBe(target);
    expect(alt.primaryMuscles.some((m) => getExercise(target).primaryMuscles.includes(m))).toBe(true);
    expect(swapped.swappedOut).toContain(target);
    const again = swapCard(swapped, alt.id, ctx(seeded(5)))!;
    expect(again.hand[0]).not.toBe(target);
  });

  it('alternatives prefer the closest match', () => {
    const alts = alternativesFor('bench_press', ALL_EQUIPMENT, [], seeded(6));
    expect(alts[0].primaryMuscles).toContain('chest');
    expect(alts[0].isCompound).toBe(true);
  });

  it('after the deck runs out, deals cards for the least-trained muscles', () => {
    const equipment: EquipmentId[] = ALL_EQUIPMENT;
    let s = startHand(config.deck.starter, ctx(seeded(7), { equipment }));
    const trained = emptyMuscleMap();
    // Train everything except biceps a lot.
    for (const m of Object.keys(trained) as (keyof typeof trained)[]) trained[m] = m === 'biceps' ? 0 : 6;
    for (let i = 0; i < 3; i++) s = finishCard(s, s.hand[0], ctx(seeded(10 + i), { equipment, trained }));
    expect(s.hand).toHaveLength(config.deck.handSize);
    expect(s.hand.some((id) => getExercise(id).primaryMuscles.includes('biceps'))).toBe(true);
  });

  it('never deals locked cards, even as fillers', () => {
    const lockedMuscle = (id: string) => getExercise(id).primaryMuscles.includes('chest');
    let s = startHand(config.deck.starter, ctx(seeded(20), { isLocked: lockedMuscle }));
    expect(s.hand.some(lockedMuscle)).toBe(false);
    for (let i = 0; i < 6; i++) {
      s = finishCard(s, s.hand[0], ctx(seeded(30 + i), { isLocked: lockedMuscle }));
      expect(s.hand.some(lockedMuscle), s.hand.join()).toBe(false);
    }
    // The locked starter card waits in the draw pile rather than vanishing.
    expect([...s.drawPile, ...s.discard, ...s.hand]).toContain('bench_press');
  });

  it('swap never offers a locked alternative', () => {
    const s = { hand: ['bench_press'], drawPile: [], discard: [], swappedOut: [] };
    const isLocked = (id: string) => id !== 'bench_press' && getExercise(id).primaryMuscles.includes('chest') && id !== 'dip';
    const out = swapCard(s, 'bench_press', ctx(seeded(40), { isLocked }));
    expect(out?.hand[0]).toBe('dip');
  });
});

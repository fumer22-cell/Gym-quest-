import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { getExercise } from '../data/exercises';
import type { LoggedSet } from '../types';
import { allInZone, carryoverByMuscle, decayFactor, lockedBy, meterStatus, muscleMeters } from './fatigue';

const H = 3_600_000;
const NOW = 1_000 * H;
const set = (exerciseId: string, hoursAgo = 0, over: Partial<LoggedSet> = {}): LoggedSet => ({
  sessionId: 1, exerciseId, weightKg: 50, reps: 8, isWarmup: false, loggedAt: NOW - hoursAgo * H, ...over,
});
const times = (n: number, f: () => LoggedSet) => Array.from({ length: n }, f);

describe('carryover', () => {
  it('decays linearly to 0 over 72 hours', () => {
    expect(decayFactor(0)).toBe(1);
    expect(decayFactor(36 * H)).toBeCloseTo(0.5, 9);
    expect(decayFactor(72 * H)).toBe(0);
    expect(decayFactor(100 * H)).toBe(0);
  });

  it('applies primary 1.0 / secondary 0.5 credit and ignores warm-ups', () => {
    const c = carryoverByMuscle(
      [set('bench_press', 36), set('bench_press', 36), set('bench_press', 0, { isWarmup: true })],
      NOW,
    );
    expect(c.chest).toBeCloseTo(1, 9); // 2 sets × 0.5 decay
    expect(c.triceps).toBeCloseTo(0.5, 9);
    expect(c.quads).toBe(0);
  });
});

describe('meters', () => {
  it('session sets drive the zone, fatigue = session + carryover', () => {
    const m = muscleMeters(times(4, () => set('leg_extension')), times(2, () => set('leg_extension', 24)), NOW);
    expect(m.quads.sessionSets).toBe(4);
    expect(m.quads.carryover).toBeCloseTo(2 * (2 / 3), 9);
    expect(m.quads.fatigue).toBeCloseTo(4 + 4 / 3, 9);
    expect(m.quads.status).toBe('zone');
    expect(m.chest.status).toBe('under');
  });

  it('status is under → zone → cap', () => {
    const { min } = config.volume.targetZone;
    expect(meterStatus(min - 1, min - 1)).toBe('under');
    expect(meterStatus(min, min)).toBe('zone');
    expect(meterStatus(min, config.volume.fatigueCap)).toBe('cap');
    // Carryover alone can cap a muscle before it reaches its zone today.
    expect(meterStatus(1, config.volume.fatigueCap)).toBe('cap');
  });

  it('warm-ups add no fatigue and no session sets', () => {
    const m = muscleMeters(times(20, () => set('bench_press', 0, { isWarmup: true })), [], NOW);
    expect(m.chest.fatigue).toBe(0);
  });

  it('is cleared only when every muscle is in its zone', () => {
    const all = ['bench_press', 'barbell_row', 'lateral_raise', 'dumbbell_curl', 'triceps_pushdown', 'leg_extension', 'leg_curl', 'cable_crunch'];
    const sets = all.flatMap((id) => times(4, () => set(id)));
    expect(allInZone(muscleMeters(sets, [], NOW))).toBe(true);
    expect(allInZone(muscleMeters(sets.slice(4), [], NOW))).toBe(false);
  });
});

describe('lockout', () => {
  const capChest = muscleMeters(times(config.volume.fatigueCap, () => set('cable_fly')), [], NOW);

  it('locks an isolation when its primary muscle hits the cap', () => {
    expect(lockedBy(getExercise('cable_fly'), capChest)).toBe('chest');
    expect(lockedBy(getExercise('lateral_raise'), capChest)).toBeNull();
  });

  it('locks a compound when any of its primary muscles hits the cap', () => {
    expect(lockedBy(getExercise('bench_press'), capChest)).toBe('chest');
    // Dips are chest + triceps primary: capped chest locks them too.
    expect(lockedBy(getExercise('dip'), capChest)).toBe('chest');
    // Chest is only secondary on close-grip bench.
    expect(lockedBy(getExercise('close_grip_bench_press'), capChest)).toBeNull();
  });

  it('carryover from yesterday can lock a card today', () => {
    const m = muscleMeters([], times(12, () => set('leg_extension', 24)), NOW); // 12 × 2/3 = 8
    expect(m.quads.status).toBe('cap');
    expect(lockedBy(getExercise('back_squat'), m)).toBe('quads');
  });
});

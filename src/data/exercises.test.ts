import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { MUSCLES } from '../types';
import { EQUIPMENT } from './equipment';
import { EXERCISES, getExercise } from './exercises';

describe('exercise database', () => {
  it('has ~30+ exercises with unique ids', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });

  it('covers every muscle group with at least 3 primary exercises', () => {
    for (const m of MUSCLES) {
      const n = EXERCISES.filter((e) => e.primaryMuscles.includes(m)).length;
      expect(n, m).toBeGreaterThanOrEqual(3);
    }
  });

  it('never lists a muscle as both primary and secondary', () => {
    for (const e of EXERCISES) {
      for (const m of e.secondaryMuscles) expect(e.primaryMuscles, e.id).not.toContain(m);
    }
  });

  it('only uses known equipment', () => {
    const known = new Set(EQUIPMENT.map((e) => e.id));
    for (const e of EXERCISES) for (const q of e.equipment) expect(known.has(q), `${e.id}:${q}`).toBe(true);
  });

  it('blocks AMRAP and drop sets on heavy free-weight barbell compounds (safety whitelist)', () => {
    const heavy = EXERCISES.filter((e) => e.isCompound && e.equipment.includes('barbell'));
    expect(heavy.map((e) => e.id)).toEqual(
      expect.arrayContaining(['back_squat', 'deadlift', 'bench_press', 'overhead_press']),
    );
    for (const e of heavy) {
      expect(e.allowedModifiers, e.id).not.toContain('amrap');
      expect(e.allowedModifiers, e.id).not.toContain('dropset');
    }
  });

  it('has exactly one exercise per boss lift', () => {
    for (const lift of ['bench', 'squat', 'deadlift', 'ohp'] as const) {
      expect(EXERCISES.filter((e) => e.bossLift === lift)).toHaveLength(1);
    }
  });

  it('wires parent-compound ratios from config onto real exercises', () => {
    for (const id of Object.keys(config.parentRatios)) {
      const e = getExercise(id);
      expect(e.parentCompound?.lift).toBe((config.parentRatios as Record<string, { lift: string }>)[id].lift);
      expect(e.bossLift).toBeUndefined();
    }
  });

  it('starter deck exercises all exist', () => {
    for (const id of config.deck.starter) expect(() => getExercise(id)).not.toThrow();
  });
});

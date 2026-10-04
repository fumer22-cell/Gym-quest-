import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { getExercise } from '../data/exercises';
import type { LoggedSet } from '../types';
import {
  baselineVolume, bestPerformance, computeDamage, epley1RM, evaluateSet, median, setVolume, weaknessMatch,
} from './strength';

const bench = getExercise('bench_press');
const pullup = getExercise('pull_up');

let t = 0;
const s = (sessionId: number, weightKg: number, reps: number, over: Partial<LoggedSet> = {}): LoggedSet => ({
  sessionId, exerciseId: 'bench_press', weightKg, reps, isWarmup: false, loggedAt: ++t, ...over,
});

describe('Epley 1RM', () => {
  it('is weight × (1 + reps/30)', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3);
    expect(epley1RM(100, 0)).toBe(100);
    expect(epley1RM(75, 5)).toBeCloseTo(87.5, 6);
  });
});

describe('set volume', () => {
  it('is weight × reps, or reps for bodyweight', () => {
    expect(setVolume(bench, { weightKg: 60, reps: 8 })).toBe(480);
    expect(setVolume(pullup, { weightKg: 0, reps: 12 })).toBe(12);
  });
});

describe('baseline', () => {
  it('is the median working-set volume over the last 3 sessions, excluding the current one', () => {
    const history = [
      s(1, 200, 1), // session 1 is too old once 4 sessions exist
      s(2, 50, 10), s(2, 50, 10), // 500, 500
      s(3, 60, 10), // 600
      s(4, 40, 10, { isWarmup: true }), s(4, 70, 10), // warm-up ignored, 700
      s(5, 999, 10), // current session ignored
    ];
    // sessions 4, 3, 2 → [700, 600, 500, 500] → median 550
    expect(baselineVolume(bench, history, 5)).toBe(550);
  });

  it('is null with no prior history', () => {
    expect(baselineVolume(bench, [], 1)).toBeNull();
    expect(baselineVolume(bench, [s(1, 50, 5)], 1)).toBeNull();
  });

  it('median handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('damage', () => {
  it('is 100 × volume / baseline', () => {
    expect(computeDamage({ volume: 500, baseline: 500, isPR: false })).toBe(100);
    expect(computeDamage({ volume: 600, baseline: 500, isPR: false })).toBe(120);
  });

  it('clamps to 25–250 before multipliers', () => {
    expect(computeDamage({ volume: 10, baseline: 500, isPR: false })).toBe(config.damage.clampMin);
    expect(computeDamage({ volume: 5000, baseline: 500, isPR: false })).toBe(config.damage.clampMax);
    // The crit multiplies the clamped value, so a huge PR set deals 250 × 2.
    expect(computeDamage({ volume: 5000, baseline: 500, isPR: true })).toBe(500);
  });

  it('crits ×2 on a PR, halves on a secondary match, and is 0 with no match', () => {
    expect(computeDamage({ volume: 500, baseline: 500, isPR: true })).toBe(200);
    expect(computeDamage({ volume: 500, baseline: 500, isPR: false, match: 'secondary' })).toBe(50);
    expect(computeDamage({ volume: 500, baseline: 500, isPR: true, match: 'secondary' })).toBe(100);
    expect(computeDamage({ volume: 500, baseline: 500, isPR: true, match: 'none' })).toBe(0);
  });

  it('deals calibration damage with no history', () => {
    expect(computeDamage({ volume: 123, baseline: null, isPR: false })).toBe(config.damage.calibrationDamage);
  });

  it('matches weaknesses by primary and secondary muscles', () => {
    expect(weaknessMatch(bench, 'chest')).toBe('primary');
    expect(weaknessMatch(bench, 'triceps')).toBe('secondary');
    expect(weaknessMatch(bench, 'quads')).toBe('none');
  });
});

describe('evaluateSet', () => {
  const history = [s(1, 60, 8), s(1, 60, 8), s(2, 62.5, 8)];

  it('flags a PR when the estimated 1RM beats every earlier set', () => {
    const best = bestPerformance(bench, history)!;
    expect(best).toBeCloseTo(epley1RM(62.5, 8), 6);
    const pr = evaluateSet(bench, { weightKg: 65, reps: 8, isWarmup: false }, history, 3);
    expect(pr.isPR).toBe(true);
    // baseline median(480, 480, 500) = 480; 65×8 = 520 → 108.33 → ×2 = 217
    expect(pr.damage).toBe(217);
    const same = evaluateSet(bench, { weightKg: 62.5, reps: 8, isWarmup: false }, history, 3);
    expect(same.isPR).toBe(false);
  });

  it('never makes the first-ever set a PR, and warm-ups deal nothing', () => {
    expect(evaluateSet(bench, { weightKg: 100, reps: 5, isWarmup: false }, [], 1).isPR).toBe(false);
    const w = evaluateSet(bench, { weightKg: 100, reps: 5, isWarmup: true }, history, 3);
    expect(w).toMatchObject({ damage: 0, isPR: false });
  });

  it('uses reps for bodyweight PRs', () => {
    const h = [s(1, 0, 10, { exerciseId: 'pull_up' })];
    expect(evaluateSet(pullup, { weightKg: 0, reps: 11, isWarmup: false }, h, 2)).toMatchObject({ isPR: true, damage: 220, e1rm: null });
  });
});

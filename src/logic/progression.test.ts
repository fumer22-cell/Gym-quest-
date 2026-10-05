import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { getExercise } from '../data/exercises';
import type { LoggedSet } from '../types';
import { muscleMeters } from './fatigue';
import { masteryBonus, masteryLevel, masteryTier } from './mastery';
import { areOpposite, canUseModifier, fatigueWeight, unlockedModifiers } from './modifiers';
import {
  computeWeakPoint, learnRatios, meetsWeakPoint, nemesisReady, predictCompound1RM, roundLoadable,
} from './readiness';
import { epley1RM } from './strength';
import { fromKg, toKg } from './units';

const lb = (v: number) => toKg(v, 'lb');
let t = 0;
const set = (exerciseId: string, weightLb: number, reps: number, sessionId = 1, over: Partial<LoggedSet> = {}): LoggedSet => ({
  sessionId, exerciseId, weightKg: lb(weightLb), reps, isWarmup: false, loggedAt: ++t, ...over,
});

describe('modifiers', () => {
  it('unlock with progress', () => {
    expect(unlockedModifiers(0)).toEqual(['superset', 'paused']);
    expect(unlockedModifiers(config.modifiers.unlocks.amrap)).toEqual(['superset', 'paused', 'dropset', 'amrap']);
  });

  it('never allow AMRAP or drop sets on heavy barbell lifts, even when unlocked', () => {
    const all = unlockedModifiers(99);
    for (const id of ['back_squat', 'deadlift', 'bench_press', 'overhead_press']) {
      expect(canUseModifier(getExercise(id), 'amrap', all)).toBe(false);
      expect(canUseModifier(getExercise(id), 'dropset', all)).toBe(false);
      expect(canUseModifier(getExercise(id), 'paused', all)).toBe(true);
    }
    expect(canUseModifier(getExercise('cable_curl'), 'amrap', all)).toBe(true);
    expect(canUseModifier(getExercise('cable_curl'), 'amrap', unlockedModifiers(0))).toBe(false);
  });

  it('pairs opposite muscle groups for supersets', () => {
    expect(areOpposite(getExercise('bench_press'), getExercise('barbell_row'))).toBe(true);
    expect(areOpposite(getExercise('dumbbell_curl'), getExercise('triceps_pushdown'))).toBe(true);
    expect(areOpposite(getExercise('leg_extension'), getExercise('leg_curl'))).toBe(true);
    expect(areOpposite(getExercise('bench_press'), getExercise('overhead_press'))).toBe(false);
    expect(areOpposite(getExercise('cable_crunch'), getExercise('back_squat'))).toBe(true);
  });

  it('drop sets count as 2 sets of fatigue but 1 session set', () => {
    expect(fatigueWeight({ modifier: 'dropset' })).toBe(2);
    expect(fatigueWeight({})).toBe(1);
    const m = muscleMeters([set('cable_curl', 40, 10, 1, { modifier: 'dropset' })], [], t);
    expect(m.biceps.sessionSets).toBe(1);
    expect(m.biceps.fatigue).toBe(2);
  });
});

describe('card mastery', () => {
  const bench = getExercise('bench_press');
  it('levels up every +5% over your first estimated 1RM, without end', () => {
    const first = set('bench_press', 100, 5);
    expect(masteryLevel(bench, [first])).toBe(0);
    expect(masteryLevel(bench, [first, set('bench_press', 105, 5)])).toBe(1);
    expect(masteryLevel(bench, [first, set('bench_press', 200, 5)])).toBe(20);
    expect(masteryTier(0)).toBe('Plain');
    expect(masteryTier(4)).toBe('Silver');
    expect(masteryTier(25)).toBe('Mythic');
  });
  it('uses reps for bodyweight and caps the damage bonus', () => {
    const pu = getExercise('pull_up');
    expect(masteryLevel(pu, [set('pull_up', 0, 6), set('pull_up', 0, 11)])).toBe(2);
    expect(masteryBonus(3)).toBeCloseTo(0.06, 9);
    expect(masteryBonus(50)).toBe(config.mastery.maxBonus);
  });
});

describe('boss readiness (§10)', () => {
  it('reproduces the spec example: predicted ~190 → Bench 165 × 5, capped at 170 by a last bench of 155', () => {
    // Accessories whose blend predicts 190 lb: incline 152 e1RM × 1.25 = 190, machine 190 × 1.0 = 190.
    const incline1RM = 152;
    const history = [
      set('incline_bench_press', incline1RM / (1 + 5 / 30), 5, 1),
      set('machine_chest_press', 190 / (1 + 8 / 30), 8, 1),
      set('bench_press', 155, 5, 1),
    ];
    const pred = predictCompound1RM('bench', history, {});
    expect(fromKg(pred.predicted!, 'lb')).toBeCloseTo(190, 0);
    const wp = computeWeakPoint('bench', history, {}, 'lb');
    expect(fromKg(wp.targetWeightKg, 'lb')).toBe(165);
    expect(wp.targetReps).toBe(5);
    expect(wp.calibration).toBe(false);
    expect(wp.thresholdE1rm).toBeCloseTo(epley1RM(lb(165), config.boss.minReps), 6);
  });

  it('caps the target at +10% of the last real bench (and +5% for squat/deadlift)', () => {
    const strongAccessories = [set('close_grip_bench_press', 250, 5, 1), set('bench_press', 135, 5, 1)];
    const wp = computeWeakPoint('bench', strongAccessories, {}, 'lb');
    expect(fromKg(wp.targetWeightKg, 'lb')).toBe(145); // 135 × 1.10 = 148.5 → 145
    const squat = computeWeakPoint('squat', [set('front_squat', 300, 5, 1), set('back_squat', 200, 5, 1)], {}, 'lb');
    expect(fromKg(squat.targetWeightKg, 'lb')).toBe(210); // 200 × 1.05
  });

  it('counts both dumbbells for pair ratios', () => {
    // 2 × 60 lb for 10 reps → pair e1RM 160 × 1.05 = 168
    const pred = predictCompound1RM('bench', [set('dumbbell_bench_press', 60, 10, 1)], {});
    expect(fromKg(pred.predicted!, 'lb')).toBeCloseTo(168, 6);
  });

  it('runs a conservative calibration fight with no compound history', () => {
    const wp = computeWeakPoint('bench', [set('incline_bench_press', 100, 5, 1)], {}, 'lb');
    expect(wp.calibration).toBe(true);
    // 116.67 × 1.25 = 145.8 × 0.80 = 116.7 → 115
    expect(fromKg(wp.targetWeightKg, 'lb')).toBe(115);
    const blank = computeWeakPoint('squat', [], {}, 'kg');
    expect(blank).toMatchObject({ calibration: true, predictedE1rm: null });
    expect(meetsWeakPoint(blank, { exerciseId: 'back_squat', weightKg: 20, reps: 5, isWarmup: false })).toBe(true);
    expect(meetsWeakPoint(blank, { exerciseId: 'leg_press', weightKg: 200, reps: 5, isWarmup: false })).toBe(false);
  });

  it('breaks on the matching compound when the set reaches target weight × min reps', () => {
    const history = [set('bench_press', 155, 5, 1), set('incline_bench_press', 130, 5, 1)];
    const wp = computeWeakPoint('bench', history, {}, 'lb');
    const target = fromKg(wp.targetWeightKg, 'lb');
    expect(meetsWeakPoint(wp, { exerciseId: 'bench_press', weightKg: lb(target), reps: 3, isWarmup: false })).toBe(true);
    expect(meetsWeakPoint(wp, { exerciseId: 'bench_press', weightKg: lb(target), reps: 2, isWarmup: false })).toBe(false);
    expect(meetsWeakPoint(wp, { exerciseId: 'bench_press', weightKg: lb(target), reps: 5, isWarmup: true })).toBe(false);
  });

  it('nudges personal ratios toward reality: ratio × (actual / predicted)^0.3', () => {
    const wp = computeWeakPoint('bench', [set('incline_bench_press', 100, 5, 1), set('bench_press', 135, 5, 1)], {}, 'lb');
    const actual = wp.predictedE1rm! * 0.9;
    const learned = learnRatios(wp, actual, {});
    expect(learned.incline_bench_press).toBeCloseTo(1.25 * 0.9 ** 0.3, 9);
    // The next prediction uses the learned ratio.
    const next = predictCompound1RM('bench', [set('incline_bench_press', 100, 5, 2)], learned);
    expect(next.predicted!).toBeLessThan(wp.predictedE1rm!);
  });

  it('a nemesis returns only once the prediction beats its weak point', () => {
    const nem = { lift: 'bench' as const, targetWeightKg: lb(165) };
    expect(nemesisReady(nem, [set('bench_press', 150, 5, 1)], {})).toBe(false); // 175 < 165×1.1=181.5
    expect(nemesisReady(nem, [set('bench_press', 160, 5, 1)], {})).toBe(true); // 186.7
  });

  it('rounds down to loadable plates', () => {
    expect(fromKg(roundLoadable(lb(167.9), 'lb'), 'lb')).toBe(165);
    expect(roundLoadable(76, 'kg')).toBe(75);
  });
});

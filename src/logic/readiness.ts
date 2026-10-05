import { config } from '../config';
import { EXERCISES, findExercise } from '../data/exercises';
import type { BossLift, Exercise, LoggedSet, Unit, WeakPoint } from '../types';
import { epley1RM } from './strength';
import { fromKg, toKg } from './units';

const PARENT = config.parentRatios as Record<string, { lift: BossLift; ratio: number; weight: number }>;

export function compoundFor(lift: BossLift): Exercise {
  const ex = EXERCISES.find((e) => e.bossLift === lift);
  if (!ex) throw new Error(`No compound for ${lift}`);
  return ex;
}

export function accessoriesFor(lift: BossLift): Exercise[] {
  return EXERCISES.filter((e) => e.parentCompound?.lift === lift);
}

/** Working sets from the exercise's most recent N sessions. */
function recentWorking(history: LoggedSet[], exerciseId: string, sessions: number): LoggedSet[] {
  const sets = history.filter((s) => s.exerciseId === exerciseId && !s.isWarmup && s.reps > 0);
  const order = [...new Set([...sets].sort((a, b) => b.loggedAt - a.loggedAt).map((s) => s.sessionId))].slice(0, sessions);
  return sets.filter((s) => order.includes(s.sessionId));
}

/** Estimated 1RM of a set as a barbell-equivalent load (dumbbell pairs count both hands). */
export function loadE1rm(ex: Pick<Exercise, 'perHand'>, s: Pick<LoggedSet, 'weightKg' | 'reps'>): number {
  return epley1RM(s.weightKg * (ex.perHand ? 2 : 1), s.reps);
}

/** Round down to a weight you can actually load, in the user's unit. */
export function roundLoadable(kg: number, unit: Unit): number {
  const inc = config.boss.loadableIncrement[unit];
  const v = Math.floor(fromKg(kg, unit) / inc + 1e-9) * inc;
  return toKg(Math.max(inc, v), unit);
}

export interface Prediction {
  predicted: number | null;
  sources: WeakPoint['sources'];
}

/** §10 steps 1–3: convert recent accessory 1RMs to compound estimates and blend them. */
export function predictCompound1RM(lift: BossLift, history: LoggedSet[], ratios: Record<string, number> = {}): Prediction {
  const n = config.boss.recentSessions;
  const sources: WeakPoint['sources'] = [];
  let sum = 0;
  let weights = 0;
  for (const acc of accessoriesFor(lift)) {
    const recent = recentWorking(history, acc.id, n);
    if (recent.length === 0) continue;
    const e1rm = Math.max(...recent.map((s) => loadE1rm(acc, s)));
    const ratio = ratios[acc.id] ?? PARENT[acc.id].ratio;
    const w = PARENT[acc.id].weight;
    sources.push({ exerciseId: acc.id, e1rm, ratio });
    sum += e1rm * ratio * w;
    weights += w;
  }
  if (weights > 0) return { predicted: sum / weights, sources };
  // No accessory data: the compound's own recent best is the prediction.
  const own = recentWorking(history, compoundFor(lift).id, n);
  if (own.length) return { predicted: Math.max(...own.map((s) => epley1RM(s.weightKg, s.reps))), sources: [] };
  return { predicted: null, sources: [] };
}

/** Heaviest working weight in the most recent session of the compound. */
export function lastPerformanceKg(lift: BossLift, history: LoggedSet[]): number | null {
  const recent = recentWorking(history, compoundFor(lift).id, 1);
  return recent.length ? Math.max(...recent.map((s) => s.weightKg)) : null;
}

/** §10: the boss's weak point for this lifter right now. */
export function computeWeakPoint(
  lift: BossLift,
  history: LoggedSet[],
  ratios: Record<string, number>,
  unit: Unit,
): WeakPoint {
  const b = config.boss;
  const compound = compoundFor(lift);
  const { predicted, sources } = predictCompound1RM(lift, history, ratios);
  const last = lastPerformanceKg(lift, history);
  const calibration = last === null;
  let targetKg: number;
  if (predicted === null) {
    targetKg = toKg(config.logging.defaultStart[unit].barbell, unit);
  } else {
    targetKg = roundLoadable(predicted * (calibration ? b.calibrationPct : b.thresholdPct), unit);
    if (last !== null) targetKg = Math.min(targetKg, roundLoadable(last * (1 + b.safetyCap[lift]), unit));
  }
  return {
    lift,
    exerciseId: compound.id,
    targetWeightKg: targetKg,
    targetReps: b.targetReps,
    thresholdE1rm: epley1RM(targetKg, b.minReps),
    predictedE1rm: predicted,
    calibration,
    sources,
  };
}

/** Does this set break the weak point? */
export function meetsWeakPoint(wp: WeakPoint, set: Pick<LoggedSet, 'exerciseId' | 'weightKg' | 'reps' | 'isWarmup'>): boolean {
  if (set.isWarmup || set.exerciseId !== wp.exerciseId) return false;
  // Calibration fights with no data at all: any honest working set counts.
  if (wp.calibration && wp.predictedE1rm === null) return set.reps > 0;
  return epley1RM(set.weightKg, set.reps) >= wp.thresholdE1rm * (1 - config.boss.tolerance);
}

/** §10 step 6: nudge personal ratios toward reality after a boss attempt. */
export function learnRatios(wp: WeakPoint, actualE1rm: number, ratios: Record<string, number>): Record<string, number> {
  if (!wp.predictedE1rm || actualE1rm <= 0 || wp.sources.length === 0) return ratios;
  const k = (actualE1rm / wp.predictedE1rm) ** config.boss.ratioLearningExponent;
  const out = { ...ratios };
  for (const s of wp.sources) out[s.exerciseId] = s.ratio * k;
  return out;
}

/** A nemesis returns once the formula says you can beat its weak point. */
export function nemesisReady(target: { lift: BossLift; targetWeightKg: number }, history: LoggedSet[], ratios: Record<string, number>): boolean {
  const { predicted } = predictCompound1RM(target.lift, history, ratios);
  return predicted !== null && predicted >= epley1RM(target.targetWeightKg, config.boss.minReps);
}

export function exerciseName(id: string): string {
  return findExercise(id)?.name ?? id;
}

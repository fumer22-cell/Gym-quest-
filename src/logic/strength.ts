import { config } from '../config';
import type { Exercise, LoggedSet, Muscle } from '../types';

type SetLike = Pick<LoggedSet, 'weightKg' | 'reps'>;

/** Epley: weight × (1 + reps / 30). */
export function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** weight × reps, or just reps for bodyweight exercises. */
export function setVolume(ex: Pick<Exercise, 'isBodyweight'>, s: SetLike): number {
  return ex.isBodyweight ? s.reps : s.weightKg * s.reps;
}

/** What a PR is measured on: estimated 1RM, or reps for bodyweight exercises. */
export function performance(ex: Pick<Exercise, 'isBodyweight'>, s: SetLike): number {
  return ex.isBodyweight ? s.reps : epley1RM(s.weightKg, s.reps);
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/**
 * Median working-set volume over the most recent sessions of this exercise
 * (config.damage.baselineSessions), ignoring the session in progress.
 */
export function baselineVolume(
  ex: Pick<Exercise, 'isBodyweight'>,
  history: LoggedSet[],
  currentSessionId?: number,
): number | null {
  const bySession = new Map<number, LoggedSet[]>();
  for (const s of history) {
    if (s.isWarmup || s.sessionId === currentSessionId) continue;
    if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []);
    bySession.get(s.sessionId)!.push(s);
  }
  const recent = [...bySession.values()]
    .sort((a, b) => Math.max(...b.map((s) => s.loggedAt)) - Math.max(...a.map((s) => s.loggedAt)))
    .slice(0, config.damage.baselineSessions);
  const m = median(recent.flat().map((s) => setVolume(ex, s)));
  return m && m > 0 ? m : null;
}

/** Best performance across all prior working sets, or null with no history. */
export function bestPerformance(ex: Pick<Exercise, 'isBodyweight'>, history: LoggedSet[]): number | null {
  const working = history.filter((s) => !s.isWarmup);
  if (working.length === 0) return null;
  return Math.max(...working.map((s) => performance(ex, s)));
}

export type WeaknessMatch = 'primary' | 'secondary' | 'none';

export function weaknessMatch(ex: Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>, weakness: Muscle): WeaknessMatch {
  if (ex.primaryMuscles.includes(weakness)) return 'primary';
  if (ex.secondaryMuscles.includes(weakness)) return 'secondary';
  return 'none';
}

export interface DamageInput {
  volume: number;
  /** null = no history yet; the set deals calibration damage. */
  baseline: number | null;
  isPR: boolean;
  match?: WeaknessMatch;
}

/** §6: 100 × volume / baseline, clamped, ×2 on a PR, then weakness match. */
export function computeDamage({ volume, baseline, isPR, match = 'primary' }: DamageInput): number {
  const d = config.damage;
  if (match === 'none') return 0;
  const raw = baseline ? (d.base * volume) / baseline : d.calibrationDamage;
  let dmg = Math.min(d.clampMax, Math.max(d.clampMin, raw));
  if (isPR) dmg *= d.critMultiplier;
  if (match === 'secondary') dmg *= d.secondaryMatchMultiplier;
  return Math.round(dmg);
}

export interface SetEvaluation {
  damage: number;
  isPR: boolean;
  e1rm: number | null;
  baseline: number | null;
  best: number | null;
}

/**
 * Score a set against the exercise's history (all prior sets, any order).
 * Warm-ups deal no damage and can't be PRs. The first time you ever do an
 * exercise there is nothing to beat, so it can't be a PR either.
 */
export function evaluateSet(
  ex: Pick<Exercise, 'isBodyweight'>,
  set: SetLike & { isWarmup: boolean },
  history: LoggedSet[],
  currentSessionId?: number,
  match: WeaknessMatch = 'primary',
): SetEvaluation {
  const baseline = baselineVolume(ex, history, currentSessionId);
  const best = bestPerformance(ex, history);
  const e1rm = ex.isBodyweight ? null : epley1RM(set.weightKg, set.reps);
  if (set.isWarmup) return { damage: 0, isPR: false, e1rm, baseline, best };
  const isPR = best !== null && performance(ex, set) > best + 1e-9;
  const damage = computeDamage({ volume: setVolume(ex, set), baseline, isPR, match });
  return { damage, isPR, e1rm, baseline, best };
}

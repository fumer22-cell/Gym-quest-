import { config } from '../config';
import type { Exercise, LoggedSet } from '../types';
import { performance } from './strength';

/**
 * Card mastery: one level per +5% of the first estimated 1RM you ever logged on the exercise
 * (+2 reps for bodyweight). It never finishes because strength can always improve.
 */
export function masteryLevel(ex: Pick<Exercise, 'isBodyweight'>, history: LoggedSet[]): number {
  const working = history.filter((s) => !s.isWarmup).sort((a, b) => a.loggedAt - b.loggedAt);
  if (working.length === 0) return 0;
  const first = performance(ex, working[0]);
  const best = Math.max(...working.map((s) => performance(ex, s)));
  if (first <= 0) return 0;
  const m = config.mastery;
  const level = ex.isBodyweight ? (best - first) / m.bodyweightRepStep : (best / first - 1) / m.stepPct;
  return Math.max(0, Math.floor(level + 1e-9));
}

export function masteryTier(level: number): string {
  let name: string = config.mastery.tiers[0].name;
  for (const t of config.mastery.tiers) if (level >= t.level) name = t.name;
  return name;
}

/** Small damage bonus per mastery level, capped. */
export function masteryBonus(level: number): number {
  return Math.min(config.mastery.maxBonus, level * config.mastery.bonusPerLevel);
}

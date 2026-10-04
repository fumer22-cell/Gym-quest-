import { config } from '../config';
import type { Exercise, LoggedSet, Unit } from '../types';
import { toKg } from './units';

export interface Prefill {
  weightKg: number;
  reps: number;
}

function defaultStart(ex: Exercise, unit: Unit): number {
  const d = config.logging.defaultStart[unit];
  if (ex.isBodyweight) return d.bodyweight;
  const eq = ex.equipment;
  if (eq.includes('barbell')) return d.barbell;
  if (eq.includes('ez_bar')) return d.ez_bar;
  if (eq.includes('dumbbells')) return d.dumbbells;
  if (eq.includes('kettlebell')) return d.kettlebell;
  if (eq.includes('cable')) return d.cable;
  return d.machine;
}

/**
 * Prefill for the next set of an exercise. `history` is that exercise's sets, any order.
 * The most recent working set wins; warm-ups are only used if nothing else exists.
 */
export function prefillFor(ex: Exercise, history: LoggedSet[], unit: Unit): Prefill {
  const sorted = [...history].sort((a, b) => b.loggedAt - a.loggedAt);
  const last = sorted.find((s) => !s.isWarmup) ?? sorted[0];
  if (last) return { weightKg: ex.isBodyweight ? 0 : last.weightKg, reps: last.reps };
  return { weightKg: toKg(defaultStart(ex, unit), unit), reps: config.logging.defaultReps };
}

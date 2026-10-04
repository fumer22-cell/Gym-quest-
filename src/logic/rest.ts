import { config } from '../config';
import type { Exercise } from '../types';

export type RestPhase = 'resting' | 'ready' | 'late' | 'overdue';

export function restWindow(ex: Pick<Exercise, 'isCompound'>) {
  return ex.isCompound ? config.rest.compound : config.rest.isolation;
}

/** resting < min ≤ ready ≤ max < late ≤ max+grace < overdue */
export function restPhase(ex: Pick<Exercise, 'isCompound'>, elapsedSec: number): RestPhase {
  const w = restWindow(ex);
  if (elapsedSec < w.min) return 'resting';
  if (elapsedSec <= w.max) return 'ready';
  if (elapsedSec <= w.max + config.rest.grace) return 'late';
  return 'overdue';
}

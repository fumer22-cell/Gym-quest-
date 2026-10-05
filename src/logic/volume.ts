import { config } from '../config';
import { findExercise } from '../data/exercises';
import { MUSCLES, type LoggedSet, type Muscle } from '../types';

export function emptyMuscleMap(): Record<Muscle, number> {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
}

/** Hard sets per muscle: primary = 1.0, secondary = 0.5, warm-ups = 0. */
export function setsByMuscle<T extends Pick<LoggedSet, 'exerciseId' | 'isWarmup'>>(
  sets: T[],
  weight: (s: T) => number = () => 1,
): Record<Muscle, number> {
  const out = emptyMuscleMap();
  for (const s of sets) {
    if (s.isWarmup) continue;
    const ex = findExercise(s.exerciseId);
    if (!ex) continue;
    const w = weight(s);
    for (const m of ex.primaryMuscles) out[m] += config.volume.primaryCredit * w;
    for (const m of ex.secondaryMuscles) out[m] += config.volume.secondaryCredit * w;
  }
  return out;
}

/** Sets grouped by exercise, in the order each exercise was first logged. */
export function groupByExercise<T extends Pick<LoggedSet, 'exerciseId'>>(sets: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const s of sets) {
    if (!map.has(s.exerciseId)) map.set(s.exerciseId, []);
    map.get(s.exerciseId)!.push(s);
  }
  return [...map.entries()];
}

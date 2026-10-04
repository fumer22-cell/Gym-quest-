import { config } from '../config';
import { findExercise } from '../data/exercises';
import { MUSCLES, type Exercise, type LoggedSet, type Muscle } from '../types';
import { emptyMuscleMap, setsByMuscle } from './volume';

const HOUR = 3_600_000;
const EPS = 1e-9;

export type MeterStatus = 'under' | 'zone' | 'cap';

export interface MuscleMeter {
  /** Hard sets this workout (drives the target zone). */
  sessionSets: number;
  /** Decayed fatigue left over from recent workouts. */
  carryover: number;
  /** sessionSets + carryover (drives lockout). */
  fatigue: number;
  status: MeterStatus;
}

export type Meters = Record<Muscle, MuscleMeter>;

/** Linear decay from 1 (just now) to 0 at config.volume.carryoverHours. */
export function decayFactor(ageMs: number): number {
  const hours = Math.max(0, ageMs) / HOUR;
  return Math.max(0, 1 - hours / config.volume.carryoverHours);
}

/** Fatigue still carried from sets logged before this workout. */
export function carryoverByMuscle(previousSets: LoggedSet[], now: number): Record<Muscle, number> {
  const out = emptyMuscleMap();
  for (const s of previousSets) {
    if (s.isWarmup) continue;
    const ex = findExercise(s.exerciseId);
    if (!ex) continue;
    const k = decayFactor(now - s.loggedAt);
    if (k <= 0) continue;
    for (const m of ex.primaryMuscles) out[m] += config.volume.primaryCredit * k;
    for (const m of ex.secondaryMuscles) out[m] += config.volume.secondaryCredit * k;
  }
  return out;
}

export function meterStatus(sessionSets: number, fatigue: number): MeterStatus {
  if (fatigue >= config.volume.fatigueCap - EPS) return 'cap';
  if (sessionSets >= config.volume.targetZone.min - EPS) return 'zone';
  return 'under';
}

export function muscleMeters(sessionSets: LoggedSet[], previousSets: LoggedSet[], now: number): Meters {
  const session = setsByMuscle(sessionSets);
  const carry = carryoverByMuscle(previousSets, now);
  const out = {} as Meters;
  for (const m of MUSCLES) {
    const fatigue = session[m] + carry[m];
    out[m] = { sessionSets: session[m], carryover: carry[m], fatigue, status: meterStatus(session[m], fatigue) };
  }
  return out;
}

/**
 * The capped muscle that locks this card, or null if it is playable.
 * Any capped primary muscle locks the card (compounds have more muscles, so they lock sooner).
 */
export function lockedBy(ex: Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles' | 'isCompound'>, meters: Meters): Muscle | null {
  const capped = (m: Muscle) => meters[m].status === 'cap';
  const primary = ex.primaryMuscles.find(capped);
  if (primary) return primary;
  if (ex.isCompound && config.volume.compoundLocksOnSecondary) return ex.secondaryMuscles.find(capped) ?? null;
  return null;
}

/** The workout is "cleared" on volume when every muscle reached its target zone. */
export function allInZone(meters: Meters): boolean {
  return MUSCLES.every((m) => meters[m].sessionSets >= config.volume.targetZone.min - EPS);
}

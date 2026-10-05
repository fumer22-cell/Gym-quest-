import { config } from '../config';
import { ALL_EQUIPMENT } from '../data/equipment';
import { getExercise } from '../data/exercises';
import { lockedBy, muscleMeters, type Meters } from '../logic/fatigue';
import type { DealContext, Rng } from '../logic/hand';
import type { LoggedSet, Settings } from '../types';
import { db } from './db';
import { notify } from './sync';

export const DEFAULT_SETTINGS: Settings = {
  key: 'main',
  unit: 'lb',
  equipment: ALL_EQUIPMENT,
  deck: [...config.deck.starter],
  sound: true,
  haptics: true,
};

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'key'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, key: 'main' });
  notify.settings();
}

export async function setsForSession(sessionId: number): Promise<LoggedSet[]> {
  return db.sets.where('sessionId').equals(sessionId).sortBy('loggedAt');
}

export async function historyFor(exerciseId: string, limit = 50): Promise<LoggedSet[]> {
  return db.sets
    .where('[exerciseId+loggedAt]')
    .between([exerciseId, -Infinity], [exerciseId, Infinity])
    .reverse()
    .limit(limit)
    .toArray();
}

/** Every set ever logged for an exercise (needed for PRs). */
export async function allHistoryFor(exerciseId: string): Promise<LoggedSet[]> {
  return db.sets
    .where('[exerciseId+loggedAt]')
    .between([exerciseId, -Infinity], [exerciseId, Infinity])
    .toArray();
}

/** Sets from earlier workouts that still carry fatigue. */
export async function recentPreviousSets(sessionId: number | undefined, now = Date.now()): Promise<LoggedSet[]> {
  const since = now - config.volume.carryoverHours * 3_600_000;
  const recent = await db.sets.where('loggedAt').above(since).toArray();
  return recent.filter((s) => s.sessionId !== sessionId);
}

/** Session sets + carryover for every muscle. */
export async function getMeters(sessionId: number | undefined, now = Date.now()): Promise<Meters> {
  const [current, previous] = await Promise.all([
    sessionId === undefined ? Promise.resolve([]) : setsForSession(sessionId),
    recentPreviousSets(sessionId, now),
  ]);
  return muscleMeters(current, previous, now);
}

export async function dealContext(settings: Settings, sessionId: number | undefined, rng: Rng, now = Date.now()): Promise<DealContext> {
  const meters = await getMeters(sessionId, now);
  const trained = Object.fromEntries(Object.entries(meters).map(([m, v]) => [m, v.sessionSets])) as DealContext['trained'];
  return {
    equipment: settings.equipment,
    trained,
    rng,
    isLocked: (id) => lockedBy(getExercise(id), meters) !== null,
  };
}


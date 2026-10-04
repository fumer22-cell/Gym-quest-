import { config } from '../config';
import { ALL_EQUIPMENT } from '../data/equipment';
import { getExercise } from '../data/exercises';
import { finishCard, startHand, swapCard, type HandState, type Rng } from '../logic/hand';
import { prefillFor, type Prefill } from '../logic/prefill';
import { setsByMuscle } from '../logic/volume';
import type { LoggedSet, Session, Settings, Unit } from '../types';
import { db } from './db';

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
}

export async function getActiveSession(): Promise<Session | undefined> {
  const open = await db.sessions.filter((s) => s.endedAt === undefined).toArray();
  return open.sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function startSession(rng: Rng = Math.random, now = Date.now()): Promise<Session> {
  const existing = await getActiveSession();
  if (existing) return existing;
  const settings = await getSettings();
  const hand = startHand(settings.deck, settings.equipment, rng);
  const session: Session = { startedAt: now, ...hand };
  const id = await db.sessions.add(session);
  return { ...session, id };
}

export async function endSession(sessionId: number, now = Date.now()): Promise<void> {
  await db.sessions.update(sessionId, {
    endedAt: now,
    activeExerciseId: undefined,
    restStartedAt: undefined,
    restExerciseId: undefined,
  });
}

export async function deleteSession(sessionId: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
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

export async function getPrefill(exerciseId: string, unit: Unit): Promise<Prefill> {
  return prefillFor(getExercise(exerciseId), await historyFor(exerciseId, 10), unit);
}

export async function logSet(
  input: Omit<LoggedSet, 'id' | 'loggedAt'>,
  now = Date.now(),
): Promise<LoggedSet> {
  const set: LoggedSet = { ...input, loggedAt: now };
  const id = await db.transaction('rw', db.sets, db.sessions, async () => {
    const newId = await db.sets.add(set);
    // Rest timer starts automatically after logging.
    await db.sessions.update(input.sessionId, {
      restStartedAt: now,
      restExerciseId: input.exerciseId,
    });
    return newId;
  });
  return { ...set, id };
}

export async function deleteSet(setId: number): Promise<void> {
  await db.sets.delete(setId);
}

export async function setActiveExercise(sessionId: number, exerciseId: string | undefined): Promise<void> {
  await db.sessions.update(sessionId, { activeExerciseId: exerciseId });
}

export async function stopRest(sessionId: number): Promise<void> {
  await db.sessions.update(sessionId, { restStartedAt: undefined, restExerciseId: undefined });
}

function handOf(s: Session): HandState {
  return { hand: s.hand, drawPile: s.drawPile, discard: s.discard, swappedOut: s.swappedOut };
}

/** Discard the card and draw the next one. */
export async function finishExercise(sessionId: number, exerciseId: string, rng: Rng = Math.random) {
  const [session, settings, sets] = await Promise.all([
    db.sessions.get(sessionId),
    getSettings(),
    setsForSession(sessionId),
  ]);
  if (!session) return;
  const next = finishCard(handOf(session), exerciseId, settings.equipment, setsByMuscle(sets), rng);
  await db.sessions.update(sessionId, { ...next, activeExerciseId: undefined });
}

/** "Machine taken": returns false when there is no similar exercise left to offer. */
export async function swapExercise(sessionId: number, exerciseId: string, rng: Rng = Math.random) {
  const [session, settings] = await Promise.all([db.sessions.get(sessionId), getSettings()]);
  if (!session) return false;
  const next = swapCard(handOf(session), exerciseId, settings.equipment, rng);
  if (!next) return false;
  await db.sessions.update(sessionId, { ...next });
  return true;
}

export interface Backup {
  app: 'gym-quest';
  version: 1;
  exportedAt: number;
  sessions: Session[];
  sets: LoggedSet[];
  settings: Settings[];
}

export async function exportData(): Promise<Backup> {
  const [sessions, sets, settings] = await Promise.all([
    db.sessions.toArray(),
    db.sets.toArray(),
    db.settings.toArray(),
  ]);
  return { app: 'gym-quest', version: 1, exportedAt: Date.now(), sessions, sets, settings };
}

export async function importData(backup: Backup): Promise<void> {
  if (backup?.app !== 'gym-quest') throw new Error('Not a Gym Quest backup file');
  await db.transaction('rw', db.sessions, db.sets, db.settings, async () => {
    await Promise.all([db.sessions.clear(), db.sets.clear(), db.settings.clear()]);
    await db.sessions.bulkAdd(backup.sessions);
    await db.sets.bulkAdd(backup.sets);
    await db.settings.bulkAdd(backup.settings);
  });
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, db.settings, async () => {
    await Promise.all([db.sessions.clear(), db.sets.clear(), db.settings.clear()]);
  });
}

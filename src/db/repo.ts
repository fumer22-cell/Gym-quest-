import { config } from '../config';
import { ALL_EQUIPMENT } from '../data/equipment';
import { getExercise } from '../data/exercises';
import { lockedBy, muscleMeters, type Meters } from '../logic/fatigue';
import { finishCard, startHand, swapCard, type DealContext, type HandState, type Rng } from '../logic/hand';
import { prefillFor, type Prefill } from '../logic/prefill';
import { evaluateSet } from '../logic/strength';
import type { LoggedSet, Session, Settings, Unit } from '../types';
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

export async function getActiveSession(): Promise<Session | undefined> {
  const open = await db.sessions.filter((s) => s.endedAt === undefined).toArray();
  return open.sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function startSession(rng: Rng = Math.random, now = Date.now()): Promise<Session> {
  const existing = await getActiveSession();
  if (existing) return existing;
  const settings = await getSettings();
  const hand = startHand(settings.deck, await dealContext(settings, undefined, rng, now));
  // Time-based ids stay unique across devices that sync to the same account.
  const last = await db.sessions.orderBy(':id').last();
  const session: Session = { id: Math.max(now, (last?.id ?? 0) + 1), startedAt: now, ...hand };
  await db.sessions.add(session);
  notify.session(session.id!);
  return session;
}

export async function endSession(sessionId: number, now = Date.now()): Promise<void> {
  await db.sessions.update(sessionId, {
    endedAt: now,
    activeExerciseId: undefined,
    restStartedAt: undefined,
    restExerciseId: undefined,
  });
  notify.session(sessionId);
}

export async function deleteSession(sessionId: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
  notify.session(sessionId);
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

async function dealContext(settings: Settings, sessionId: number | undefined, rng: Rng, now = Date.now()): Promise<DealContext> {
  const meters = await getMeters(sessionId, now);
  const trained = Object.fromEntries(Object.entries(meters).map(([m, v]) => [m, v.sessionSets])) as DealContext['trained'];
  return {
    equipment: settings.equipment,
    trained,
    rng,
    isLocked: (id) => lockedBy(getExercise(id), meters) !== null,
  };
}

export async function getPrefill(exerciseId: string, unit: Unit): Promise<Prefill> {
  return prefillFor(getExercise(exerciseId), await historyFor(exerciseId, 10), unit);
}

export async function logSet(
  input: Omit<LoggedSet, 'id' | 'loggedAt'>,
  now = Date.now(),
): Promise<LoggedSet> {
  const ex = getExercise(input.exerciseId);
  const history = await allHistoryFor(input.exerciseId);
  const evaluation = evaluateSet(ex, input, history, input.sessionId);
  // Sets on a locked card are junk volume: logged (never block the workout) but deal no damage.
  const locked = lockedBy(ex, await getMeters(input.sessionId, now)) !== null;
  const set: LoggedSet = {
    ...input,
    loggedAt: now,
    damage: locked ? 0 : evaluation.damage,
    isPR: evaluation.isPR,
    e1rm: evaluation.e1rm,
  };
  const id = await db.transaction('rw', db.sets, db.sessions, async () => {
    const newId = await db.sets.add(set);
    // Rest timer starts automatically after logging.
    await db.sessions.update(input.sessionId, {
      restStartedAt: now,
      restExerciseId: input.exerciseId,
    });
    return newId;
  });
  notify.session(input.sessionId);
  return { ...set, id };
}

export async function deleteSet(setId: number): Promise<void> {
  const set = await db.sets.get(setId);
  await db.sets.delete(setId);
  if (set) notify.session(set.sessionId);
}

export async function setActiveExercise(sessionId: number, exerciseId: string | undefined): Promise<void> {
  await db.sessions.update(sessionId, { activeExerciseId: exerciseId });
  notify.session(sessionId);
}

export async function stopRest(sessionId: number): Promise<void> {
  await db.sessions.update(sessionId, { restStartedAt: undefined, restExerciseId: undefined });
  notify.session(sessionId);
}

function handOf(s: Session): HandState {
  return { hand: s.hand, drawPile: s.drawPile, discard: s.discard, swappedOut: s.swappedOut };
}

/** Discard the card and draw the next one. */
export async function finishExercise(sessionId: number, exerciseId: string, rng: Rng = Math.random) {
  const [session, settings] = await Promise.all([db.sessions.get(sessionId), getSettings()]);
  if (!session) return;
  const next = finishCard(handOf(session), exerciseId, await dealContext(settings, sessionId, rng));
  await db.sessions.update(sessionId, { ...next, activeExerciseId: undefined });
  notify.session(sessionId);
}

/** "Machine taken": returns false when there is no similar exercise left to offer. */
export async function swapExercise(sessionId: number, exerciseId: string, rng: Rng = Math.random) {
  const [session, settings] = await Promise.all([db.sessions.get(sessionId), getSettings()]);
  if (!session) return false;
  const next = swapCard(handOf(session), exerciseId, await dealContext(settings, sessionId, rng));
  if (!next) return false;
  await db.sessions.update(sessionId, { ...next });
  notify.session(sessionId);
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
  notify.all();
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, db.settings, async () => {
    await Promise.all([db.sessions.clear(), db.sets.clear(), db.settings.clear()]);
  });
  notify.all();
}

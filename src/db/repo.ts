import { getExercise } from '../data/exercises';
import { lockedBy } from '../logic/fatigue';
import { finishCard, startHand, swapCard, type Rng } from '../logic/hand';
import { prefillFor, type Prefill } from '../logic/prefill';
import { evaluateSet } from '../logic/strength';
import type { LoggedSet, Session, Settings, Unit } from '../types';
import { db } from './db';
import { applyFightSet, buildRun, fightContext, handOf } from './quest';
import { allHistoryFor, dealContext, getMeters, getSettings, historyFor, updateSettings } from './queries';
import { notify } from './sync';

export * from './queries';

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
  const run = await buildRun(settings, rng, now);
  const session: Session = { id: Math.max(now, (last?.id ?? 0) + 1), startedAt: now, ...hand, run };
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

export async function getPrefill(exerciseId: string, unit: Unit): Promise<Prefill> {
  return prefillFor(getExercise(exerciseId), await historyFor(exerciseId, 10), unit);
}

export interface LogOptions {
  /** Reps planned before the set (prefill); AMRAP damage is measured against it. */
  plannedReps?: number;
  rng?: Rng;
}

/**
 * Log a set. Inside a run's fight the set is also a combat turn: it deals damage, enemies act,
 * and the rest timer starts. Outside fights it is simply recorded (the workout never blocks).
 */
export async function logSet(
  input: Omit<LoggedSet, 'id' | 'loggedAt'>,
  now = Date.now(),
  opts: LogOptions = {},
): Promise<LoggedSet> {
  const ex = getExercise(input.exerciseId);
  const history = await allHistoryFor(input.exerciseId);
  const evaluation = evaluateSet(ex, input, history, input.sessionId);
  // Sets on a locked card are junk volume: logged (never block the workout) but deal no damage.
  const locked = lockedBy(ex, await getMeters(input.sessionId, now)) !== null;
  const session = await db.sessions.get(input.sessionId);
  let set: LoggedSet = {
    ...input,
    loggedAt: now,
    damage: locked ? 0 : evaluation.damage,
    isPR: evaluation.isPR,
    e1rm: evaluation.e1rm,
  };
  let patch: Partial<Session> = {};
  let settingsPatch: Partial<Settings> | undefined;
  // Save first so fatigue (lockout, dealing) already counts this set.
  const id = await db.sets.add(set);
  if (session?.run) {
    const r = await applyFightSet(
      session,
      set,
      { evaluation, history, plannedReps: opts.plannedReps ?? input.reps, locked },
      now,
      opts.rng ?? Math.random,
    );
    set = { ...set, damage: r.damage, modifier: r.modifier, targetEnemyId: r.targetId };
    patch = r.patch;
    settingsPatch = r.settingsPatch;
  }
  await db.transaction('rw', db.sets, db.sessions, async () => {
    await db.sets.update(id, { damage: set.damage, modifier: set.modifier, targetEnemyId: set.targetEnemyId });
    // Rest timer starts automatically after logging.
    await db.sessions.update(input.sessionId, { ...patch, restStartedAt: now, restExerciseId: input.exerciseId });
  });
  notify.session(input.sessionId);
  if (settingsPatch && Object.keys(settingsPatch).length) await updateSettings(settingsPatch);
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


/** Discard the card and draw the next one. */
export async function finishExercise(sessionId: number, exerciseId: string, rng: Rng = Math.random) {
  const [session, settings] = await Promise.all([db.sessions.get(sessionId), getSettings()]);
  if (!session) return;
  const deal = session.run ? await fightContext(settings, sessionId, session.run, rng, Date.now()) : await dealContext(settings, sessionId, rng);
  const next = finishCard(handOf(session), exerciseId, deal);
  await db.sessions.update(sessionId, { ...next, activeExerciseId: undefined });
  notify.session(sessionId);
}

/** "Machine taken": returns false when there is no similar exercise left to offer. */
export async function swapExercise(sessionId: number, exerciseId: string, rng: Rng = Math.random) {
  const [session, settings] = await Promise.all([db.sessions.get(sessionId), getSettings()]);
  if (!session) return false;
  const deal = session.run ? await fightContext(settings, sessionId, session.run, rng, Date.now()) : await dealContext(settings, sessionId, rng);
  const next = swapCard(handOf(session), exerciseId, deal);
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

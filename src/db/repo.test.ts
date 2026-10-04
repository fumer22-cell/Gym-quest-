import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../config';
import { GymQuestDB, setDatabase } from './db';
import {
  deleteSet, endSession, exportData, finishExercise, getActiveSession, getPrefill,
  importData, logSet, setsForSession, startSession, swapExercise, updateSettings,
} from './repo';

let n = 0;
beforeEach(() => {
  setDatabase(new GymQuestDB(`test-${n++}`));
});

describe('repo', () => {
  it('starts one session, logs sets, prefills from last time, and starts the rest timer', async () => {
    const s = await startSession();
    expect((await startSession()).id).toBe(s.id);
    expect(s.hand).toHaveLength(config.deck.handSize);

    await logSet({ sessionId: s.id!, exerciseId: 'bench_press', weightKg: 60, reps: 8, isWarmup: false }, 1000);
    const last = await logSet({ sessionId: s.id!, exerciseId: 'bench_press', weightKg: 62.5, reps: 6, isWarmup: false }, 2000);
    expect(await getPrefill('bench_press', 'kg')).toEqual({ weightKg: 62.5, reps: 6 });

    const active = await getActiveSession();
    expect(active?.restStartedAt).toBe(2000);
    expect(active?.restExerciseId).toBe('bench_press');

    await deleteSet(last.id!);
    expect(await getPrefill('bench_press', 'kg')).toEqual({ weightKg: 60, reps: 8 });
    expect(await setsForSession(s.id!)).toHaveLength(1);

    await endSession(s.id!);
    expect(await getActiveSession()).toBeUndefined();
  });

  it('finishing and swapping cards persists the hand', async () => {
    const s = await startSession();
    const first = s.hand[0];
    await finishExercise(s.id!, first);
    let a = (await getActiveSession())!;
    expect(a.hand).not.toContain(first);
    expect(a.discard).toContain(first);
    expect(a.hand).toHaveLength(config.deck.handSize);

    const toSwap = a.hand[0];
    expect(await swapExercise(s.id!, toSwap)).toBe(true);
    a = (await getActiveSession())!;
    expect(a.hand).not.toContain(toSwap);
    expect(a.swappedOut).toContain(toSwap);
  });

  it('respects equipment settings when dealing', async () => {
    await updateSettings({ equipment: ['dumbbells', 'bench', 'cable'] });
    const s = await startSession();
    expect(s.hand.length).toBeGreaterThan(0);
    for (const id of s.hand) expect(['barbell_row', 'back_squat', 'bench_press']).not.toContain(id);
  });

  it('exports and re-imports a backup', async () => {
    const s = await startSession();
    await logSet({ sessionId: s.id!, exerciseId: 'pull_up', weightKg: 0, reps: 10, isWarmup: false });
    const backup = await exportData();
    setDatabase(new GymQuestDB(`test-${n++}`));
    await importData(backup);
    expect(await setsForSession(s.id!)).toHaveLength(1);
  });
});

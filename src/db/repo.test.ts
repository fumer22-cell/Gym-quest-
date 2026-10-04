import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../config';
import { getExercise } from '../data/exercises';
import { GymQuestDB, setDatabase } from './db';
import {
  deleteSession, deleteSet, endSession, exportData, finishExercise, getActiveSession, getMeters, getPrefill,
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

describe('milestone 2: damage & fatigue in storage', () => {
  it('stores damage, PRs and e1RM on logged sets', async () => {
    const day = 24 * 3_600_000;
    const s1 = await startSession(Math.random, 1000);
    await logSet({ sessionId: s1.id!, exerciseId: 'bench_press', weightKg: 60, reps: 8, isWarmup: false }, 1000);
    await endSession(s1.id!, 2000);
    const s2 = await startSession(Math.random, 4 * day);
    const warm = await logSet({ sessionId: s2.id!, exerciseId: 'bench_press', weightKg: 40, reps: 8, isWarmup: true }, 4 * day);
    expect(warm.damage).toBe(0);
    const same = await logSet({ sessionId: s2.id!, exerciseId: 'bench_press', weightKg: 60, reps: 8, isWarmup: false }, 4 * day + 1);
    expect(same).toMatchObject({ damage: 100, isPR: false });
    const pr = await logSet({ sessionId: s2.id!, exerciseId: 'bench_press', weightKg: 66, reps: 8, isWarmup: false }, 4 * day + 2);
    expect(pr).toMatchObject({ damage: 220, isPR: true });
    expect(pr.e1rm).toBeCloseTo(66 * (1 + 8 / 30), 6);
  });

  it('meters include carryover, and capped muscles are never dealt', async () => {
    const hour = 3_600_000;
    const s1 = await startSession(Math.random, 0);
    for (let i = 0; i < 9; i++) {
      await logSet({ sessionId: s1.id!, exerciseId: 'leg_extension', weightKg: 40, reps: 10, isWarmup: false }, i + 1);
    }
    expect((await getMeters(s1.id!, 100)).quads).toMatchObject({ sessionSets: 9, status: 'cap' });
    await endSession(s1.id!, 200);

    // An hour later, 9 × 71/72 = 8.875 sets of carryover still caps the quads.
    const later = await getMeters(undefined, hour);
    expect(later.quads.sessionSets).toBe(0);
    expect(later.quads.carryover).toBeCloseTo(9 * (71 / 72), 3);
    expect(later.quads.status).toBe('cap');

    // So a new hand never contains a quads card (the starter deck has Back Squat).
    for (let seed = 0; seed < 10; seed++) {
      const s2 = await startSession(Math.random, hour);
      for (const id of s2.hand) expect(getExercise(id).primaryMuscles).not.toContain('quads');
      await deleteSession(s2.id!);
    }
  });

  it('sets logged on a locked card deal no damage', async () => {
    const s = await startSession(Math.random, 0);
    let last;
    for (let i = 0; i < config.volume.fatigueCap + 1; i++) {
      last = await logSet({ sessionId: s.id!, exerciseId: 'cable_fly', weightKg: 20, reps: 12, isWarmup: false }, i + 1);
    }
    expect(last!.damage).toBe(0);
    expect((await setsForSession(s.id!))[0].damage).toBeGreaterThan(0);
  });
});

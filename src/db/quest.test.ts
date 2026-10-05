import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../config';
import { getExercise } from '../data/exercises';
import { matchOn } from '../logic/run/combat';
import { reachable } from '../logic/run/map';
import { toKg } from '../logic/units';
import type { Session } from '../types';
import { GymQuestDB, setDatabase } from './db';
import {
  abandonRun, checkOverrun, claimReward, enterMapNode, finishRun, fleeFight, playRest, restAtCamp,
} from './quest';
import { getActiveSession, getSettings, logSet, startSession, updateSettings } from './repo';

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let n = 0;
beforeEach(() => {
  setDatabase(new GymQuestDB(`quest-${n++}`));
});

const active = async () => (await getActiveSession())!;
let clock = 1_000_000;
const tick = (ms = 60_000) => (clock += ms);

/** Play the current fight to the end with the first playable card in hand. */
async function winFight(s: Session) {
  for (let guard = 0; guard < 40; guard++) {
    const cur = await active();
    const f = cur.run!.fight;
    if (!f || cur.run!.phase !== 'node') return;
    const card = cur.hand.find((id) => f.enemies.some((e) => e.hp > 0 && matchOn(id, e) !== 'none'));
    expect(card, `hand ${cur.hand.join()} vs ${f.enemies.map((e) => e.weakness).join()}`).toBeTruthy();
    await logSet({ sessionId: s.id!, exerciseId: card!, weightKg: 50, reps: 8, isWarmup: false }, tick());
  }
  throw new Error('fight never ended');
}

describe('training grounds', () => {
  it('is the first run: easy fights, no attacks, then calibrated', async () => {
    const s = await startSession(seeded(1), tick());
    expect(s.run!.mode).toBe('training');
    for (let i = 0; i < config.run.trainingFights; i++) {
      const run = (await active()).run!;
      expect(run.phase).toBe('map');
      await enterMapNode(s.id!, reachable(run.map, run.nodeId)[0].id, seeded(10 + i), tick());
      const fight = (await active()).run!.fight!;
      expect(fight.enemies.every((e) => e.kind === 'dummy')).toBe(true);
      // Even a very long rest never hurts in training.
      await logSet({ sessionId: s.id!, exerciseId: (await active()).hand[0], weightKg: 40, reps: 8, isWarmup: true }, tick());
      tick(3_600_000);
      expect(await checkOverrun(s.id!, seeded(1), clock)).toBeNull();
      await winFight(s);
      const after = (await active()).run!;
      expect(after.phase).toBe('reward');
      await claimReward(s.id!, { card: after.reward!.cards[0] });
    }
    const end = (await active()).run!;
    expect(end.phase).toBe('end');
    expect(end.runCards).toHaveLength(config.run.trainingFights);
    await finishRun(s.id!, { keep: end.runCards[0] }, tick());
    const settings = await getSettings();
    expect(settings.calibrated).toBe(true);
    expect(settings.deck).toContain(end.runCards[0]);
    expect(await getActiveSession()).toBeUndefined();
  });
});

describe('a real run', () => {
  beforeEach(async () => {
    await updateSettings({ calibrated: true });
  });

  it('has a branching map with a boss, campfire and treasure', async () => {
    const s = await startSession(seeded(2), tick());
    const run = s.run!;
    expect(run.mode).toBe('run');
    expect(run.bossLift).toBeTruthy();
    expect(run.map.some((x) => x.type === 'boss')).toBe(true);
    expect(run.map.some((x) => x.type === 'campfire')).toBe(true);
  });

  it('fights hand you only cards that can hit, rest cards work, campfire heals', async () => {
    const s = await startSession(seeded(3), tick());
    const first = reachable(s.run!.map, null)[0];
    await enterMapNode(s.id!, first.id, seeded(4), tick());
    const cur = await active();
    const f = cur.run!.fight!;
    expect(cur.hand.length).toBeGreaterThan(0);
    for (const id of cur.hand) expect(f.enemies.some((e) => matchOn(id, e) !== 'none'), id).toBe(true);

    // One set, then play a rest card during the rest.
    await logSet({ sessionId: s.id!, exerciseId: cur.hand[0], weightKg: 50, reps: 8, isWarmup: false }, tick());
    const resting = await active();
    const card = resting.run!.fight?.restOffer[0];
    if (card) {
      await playRest(s.id!, card, tick(1000));
      expect((await active()).run!.fight!.restCardPlayedFor).toBe(resting.restStartedAt);
    }
    await fleeFight(s.id!, seeded(5), tick());
    expect((await active()).run!.phase).toBe('map');
    expect((await active()).run!.reward).toBeUndefined();
  });

  it('an overrun rest lets a telegraphed attack land', async () => {
    const s = await startSession(seeded(6), tick());
    await enterMapNode(s.id!, reachable(s.run!.map, null)[0].id, seeded(7), tick());
    const cur = await active();
    await logSet({ sessionId: s.id!, exerciseId: cur.hand[0], weightKg: 50, reps: 8, isWarmup: false }, tick());
    // Force an attack intent on every enemy, then rest far too long.
    const r = (await active()).run!;
    const fight = { ...r.fight!, enemies: r.fight!.enemies.map((e) => ({ ...e, intents: [{ type: 'attack' as const, value: 10 }, ...e.intents.slice(1)] })) };
    const { db } = await import('./db');
    await db.sessions.update(s.id!, { run: { ...r, fight } });
    const hpBefore = r.hp;
    const late = clock + 10 * 60_000;
    const res = await checkOverrun(s.id!, seeded(1), late);
    expect(res?.hurt).toBeGreaterThan(0);
    expect((await active()).run!.hp).toBeLessThan(hpBefore);
  });

  it('boss escape creates a nemesis, and the formula learns from the attempt', async () => {
    // History so the boss has a real weak point: bench 155 × 5, incline for the ratio.
    const lb = (v: number) => toKg(v, 'lb');
    const prep = await startSession(seeded(8), tick());
    await logSet({ sessionId: prep.id!, exerciseId: 'bench_press', weightKg: lb(155), reps: 5, isWarmup: false }, tick());
    await logSet({ sessionId: prep.id!, exerciseId: 'incline_bench_press', weightKg: lb(130), reps: 5, isWarmup: false }, tick());
    await abandonRun(prep.id!, seeded(1), tick());
    await finishRun(prep.id!, {}, tick());

    await updateSettings({ lastBossLift: 'squat' });
    let s: Session | undefined;
    for (let seed = 20; seed < 60; seed++) {
      const cand = await startSession(seeded(seed), tick());
      if (cand.run!.bossLift === 'bench') {
        s = cand;
        break;
      }
      await abandonRun(cand.id!, seeded(1), tick());
      await finishRun(cand.id!, {}, tick());
    }
    expect(s).toBeDefined();
    // Walk straight to the boss.
    for (let guard = 0; guard < 10; guard++) {
      const run = (await active()).run!;
      const next = reachable(run.map, run.nodeId);
      const boss = next.find((x) => x.type === 'boss');
      const pick = boss ?? next.find((x) => x.type === 'campfire') ?? next[0];
      if (run.phase === 'node' && run.fight) await fleeFight(s!.id!, seeded(1), tick());
      if ((await active()).run!.phase === 'reward') await claimReward(s!.id!, {});
      if (pick.type === 'boss') {
        await enterMapNode(s!.id!, pick.id, seeded(2), tick());
        break;
      }
      await enterMapNode(s!.id!, pick.id, seeded(3), tick());
      if (pick.type === 'campfire') await restAtCamp(s!.id!);
      if ((await active()).run!.phase === 'reward') await claimReward(s!.id!, {});
    }
    const bossFight = (await active()).run!.fight!;
    const boss = bossFight.enemies[0];
    expect(boss.isBoss).toBe(true);
    expect(boss.name).toBe('Iron Wyrm');
    expect(boss.weakPoint!.exerciseId).toBe('bench_press');
    // Try the bench below the weak point, then leave: armor intact → escape.
    await logSet({ sessionId: s!.id!, exerciseId: 'bench_press', weightKg: lb(140), reps: 5, isWarmup: false }, tick());
    await abandonRun(s!.id!, seeded(1), tick());
    const run = (await active()).run!;
    expect(run.bossOutcome).toBe('escaped');
    const settings = await getSettings();
    expect(settings.nemeses).toHaveLength(1);
    expect(settings.nemeses![0]).toMatchObject({ lift: 'bench', targetWeightKg: boss.weakPoint!.targetWeightKg });
    expect(settings.ratios?.incline_bench_press).toBeDefined();
    expect(settings.ratios!.incline_bench_press).not.toBe(1.25);
    await finishRun(s!.id!, {}, tick());
  });

  it('fleeing a boss without attempting its weak point creates no nemesis', async () => {
    const s = await startSession(seeded(31), tick());
    const bossNode = s.run!.map.find((x) => x.type === 'boss')!;
    const { db } = await import('./db');
    const pre = s.run!.map.filter((x) => x.next.includes(bossNode.id))[0];
    await db.sessions.update(s.id!, { run: { ...s.run!, nodeId: pre.id, visited: [pre.id], phase: 'map' } });
    await enterMapNode(s.id!, bossNode.id, seeded(2), tick());
    const bossFight = await active();
    expect(bossFight.run!.fight!.enemies[0].isBoss).toBe(true);
    // The weak-point lift is always dealt, even if it is not in the deck.
    expect(bossFight.hand).toContain(bossFight.run!.fight!.enemies[0].weakPoint!.exerciseId);
    await fleeFight(s.id!, seeded(1), tick());
    expect((await active()).run!.bossOutcome).toBe('escaped');
    expect((await getSettings()).nemeses ?? []).toHaveLength(0);
    await finishRun(s.id!, {}, tick());
  });

  it('keep-one respects the deck cap by swapping a card out', async () => {
    const full = Array.from({ length: config.deck.maxSize }, (_, i) =>
      ['back_squat', 'bench_press', 'barbell_row', 'romanian_deadlift', 'overhead_press', 'lat_pulldown', 'leg_curl', 'cable_curl', 'triceps_pushdown', 'lateral_raise', 'cable_crunch', 'leg_extension'][i],
    );
    await updateSettings({ deck: full });
    const s = await startSession(seeded(9), tick());
    const { db } = await import('./db');
    await db.sessions.update(s.id!, { run: { ...s.run!, runCards: ['hammer_curl'], phase: 'end' } });
    await finishRun(s.id!, { keep: 'hammer_curl' }, tick());
    expect((await getSettings()).deck).not.toContain('hammer_curl'); // full deck, nothing removed
    const s2 = await startSession(seeded(10), tick());
    await db.sessions.update(s2.id!, { run: { ...s2.run!, runCards: ['hammer_curl'], phase: 'end' } });
    await finishRun(s2.id!, { keep: 'hammer_curl', remove: 'cable_curl' }, tick());
    const deck = (await getSettings()).deck;
    expect(deck).toContain('hammer_curl');
    expect(deck).not.toContain('cable_curl');
    expect(deck).toHaveLength(config.deck.maxSize);
    expect(getExercise('hammer_curl').primaryMuscles).toEqual(['biceps']);
  });
});

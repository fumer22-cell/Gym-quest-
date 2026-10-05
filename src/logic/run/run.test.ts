import { describe, expect, it } from 'vitest';
import { config } from '../../config';
import type { Enemy, FightState, Intent, LoggedSet, RunState } from '../../types';
import { MUSCLES } from '../../types';
import { muscleMeters } from '../fatigue';
import { computeWeakPoint } from '../readiness';
import { toKg } from '../units';
import { currentIntent, matchOn, pickTarget, playableOn, playRestCard, resolveOverrun, strike, type StrikeInput } from './combat';
import { createBoss, spawnEnemies } from './enemies';
import { fightsAhead, generateMap, reachable, trainingMap } from './map';
import { dropCandidates } from './rewards';
import { canEnter, enterNode, finishFight, makeFight, newRun, restAtCampfire, takeReward } from './run';
import { ALL_EQUIPMENT } from '../../data/equipment';

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW = 1_000_000_000;
const idle: Intent = { type: 'idle', value: 0 };
const enemy = (over: Partial<Enemy> = {}): Enemy => ({
  id: 'e1', kind: 'knight', name: 'Shield Knight', weakness: ['chest'], hp: 300, maxHp: 300, intents: [idle, idle, idle], ...over,
});
function fightRun(enemies: Enemy[], over: Partial<RunState> = {}): RunState {
  const map = generateMap(seeded(1), { length: 5 });
  const run = newRun({ mode: 'run', map, bossLift: 'bench' });
  const f: FightState = makeFight(map[0].id, enemies, seeded(2));
  return { ...run, nodeId: map[0].id, phase: 'node', fight: f, ...over };
}
const hit = (over: Partial<StrikeInput> = {}): StrikeInput => ({
  exerciseId: 'bench_press', weightKg: 60, reps: 8, isWarmup: false, baseline: 480, isPR: false,
  plannedReps: 8, masteryLevel: 0, junk: false, now: NOW, ...over,
});

describe('map', () => {
  it('builds 5–7 node paths of 2–3 branches that all end at one boss', () => {
    for (let seed = 1; seed < 60; seed++) {
      const map = generateMap(seeded(seed), { nemesis: seed % 2 === 0 });
      const layers = Math.max(...map.map((n) => n.layer)) + 1;
      expect(layers).toBeGreaterThanOrEqual(config.run.nodes.min);
      expect(layers).toBeLessThanOrEqual(config.run.nodes.max);
      expect(map.filter((n) => n.type === 'boss')).toHaveLength(1);
      for (let l = 0; l < layers - 1; l++) {
        const w = map.filter((n) => n.layer === l).length;
        expect(w).toBeGreaterThanOrEqual(2);
        expect(w).toBeLessThanOrEqual(3);
      }
      // Every node is reachable and every non-boss node leads somewhere.
      for (const n of map) {
        if (n.layer > 0) expect(map.some((p) => p.next.includes(n.id)), n.id).toBe(true);
        if (n.type !== 'boss') expect(n.next.length).toBeGreaterThan(0);
      }
      expect(map.filter((n) => n.layer === layers - 2).some((n) => n.type === 'campfire')).toBe(true);
      expect(map.filter((n) => n.type === 'nemesis').length).toBe(seed % 2 === 0 ? 1 : 0);
      expect(map.filter((n) => n.layer === 0).every((n) => n.type === 'fight')).toBe(true);
    }
  });

  it('starts at layer 0, and counts the fights ahead', () => {
    const map = generateMap(seeded(3), { length: 6 });
    expect(reachable(map, null).every((n) => n.layer === 0)).toBe(true);
    expect(fightsAhead(map, null)).toBeGreaterThanOrEqual(2);
    expect(trainingMap()).toHaveLength(config.run.trainingFights);
  });
});

describe('coverage-aware enemies', () => {
  const sets = (id: string, n: number): LoggedSet[] =>
    Array.from({ length: n }, () => ({ sessionId: 1, exerciseId: id, weightKg: 50, reps: 8, isWarmup: false, loggedAt: NOW }));

  it('spawns enemies weak to the muscles that still need work, HP = sets × 100', () => {
    const trained = ['bench_press', 'barbell_row', 'lateral_raise', 'dumbbell_curl', 'triceps_pushdown', 'leg_curl', 'cable_crunch'];
    const meters = muscleMeters(trained.flatMap((id) => sets(id, 4)), [], NOW);
    const enemies = spawnEnemies(meters, seeded(4), { idPrefix: 'x', fightsLeft: 3 });
    expect(enemies[0].weakness).toEqual(['quads']);
    expect(enemies[0].hp).toBe(enemies[0].maxHp);
    expect(enemies[0].hp % config.combat.hpPerRequiredSet).toBe(0);
    expect(enemies[0].hp).toBe(config.combat.enemySets.max * 100);
  });

  it('never spawns a capped muscle and never opens with an attack', () => {
    const meters = muscleMeters(sets('cable_fly', 8), [], NOW);
    for (let s = 0; s < 30; s++) {
      const enemies = spawnEnemies(meters, seeded(s), { idPrefix: 'x', fightsLeft: 1 });
      expect(enemies.length).toBeGreaterThan(0);
      expect(enemies.length).toBeLessThanOrEqual(3);
      for (const e of enemies) {
        expect(e.weakness).not.toContain('chest');
        expect(currentIntent(e).type).not.toBe('attack');
      }
    }
  });

  it('leaves room on the boss muscles and skips muscles nobody can train', () => {
    const meters = muscleMeters(sets('leg_extension', 3), [], NOW); // quads fatigue 3
    for (let seed = 0; seed < 20; seed++) {
      const enemies = spawnEnemies(meters, seeded(seed), {
        idPrefix: 'x', fightsLeft: 1, reserve: { muscles: ['quads'], sets: config.boss.sets }, canTrain: (m) => m !== 'core',
      });
      expect(enemies.some((e) => e.weakness.includes('quads'))).toBe(false); // 8 - 3 - 5 = 0 room
      expect(enemies.some((e) => e.weakness.includes('core'))).toBe(false);
    }
  });

  it('spreads untrained muscles over the fights left', () => {
    const fresh = muscleMeters([], [], NOW);
    expect(spawnEnemies(fresh, seeded(9), { idPrefix: 'x', fightsLeft: 3 }).length).toBe(3); // 8 muscles / 3 fights
    const training = spawnEnemies(fresh, seeded(9), { idPrefix: 'x', fightsLeft: 3, training: true });
    expect(training.every((e) => e.kind === 'dummy' && e.intents.every((i) => i.type === 'idle'))).toBe(true);
  });
});

describe('combat', () => {
  it('only cards matching a weakness are playable; secondary matches deal half', () => {
    const f = fightRun([enemy()]).fight!;
    expect(playableOn('bench_press', f)).toBe(true);
    expect(playableOn('back_squat', f)).toBe(false);
    expect(matchOn('overhead_press', enemy({ weakness: ['triceps'] }))).toBe('secondary');
    const r = strike(fightRun([enemy({ weakness: ['triceps'] })]), hit({ exerciseId: 'overhead_press', weightKg: 40, reps: 12, baseline: 480 }), seeded(1));
    expect(r.damage).toBe(50);
  });

  it('applies damage, advances the turn and declares victory', () => {
    const r = strike(fightRun([enemy({ hp: 100 })]), hit(), seeded(1));
    expect(r.damage).toBe(100);
    expect(r.run.fight!.enemies[0].hp).toBe(0);
    expect(r.run.fight!.turn).toBe(1);
    expect(r.outcome).toBe('victory');
  });

  it('armor halves unmodified cards; any modifier pierces it', () => {
    const armored = enemy({ intents: [{ type: 'armor', value: 50 }, idle, idle] });
    expect(strike(fightRun([armored]), hit(), seeded(1)).damage).toBe(50);
    expect(strike(fightRun([armored]), hit({ modifier: 'paused' }), seeded(1)).damage).toBe(80);
  });

  it('regen heals the enemy when the turn ends', () => {
    const r = strike(fightRun([enemy({ intents: [{ type: 'regen', value: 25 }, idle, idle] })]), hit(), seeded(1));
    expect(r.run.fight!.enemies[0].hp).toBe(300 - 100 + 25);
  });

  it('a new Disrupt intent asks the caller to lock a card', () => {
    const r = strike(fightRun([enemy({ intents: [idle, { type: 'disrupt', value: 1 }, idle] })]), hit(), seeded(1));
    expect(r.disrupt).toBe(true);
  });

  it('modifiers: drop set ×1.5, AMRAP scales and crits at +3 reps, each costs a charge', () => {
    const run = fightRun([enemy({ hp: 900, maxHp: 900, weakness: ['biceps'] })]);
    const curl = { exerciseId: 'cable_curl', weightKg: 20, reps: 12, baseline: 240 };
    const drop = strike(run, hit({ ...curl, modifier: 'dropset' }), seeded(1));
    expect(drop.damage).toBe(150);
    expect(drop.run.charges).toBe(run.charges - 1);
    const amrap = strike(run, hit({ ...curl, reps: 15, plannedReps: 12, modifier: 'amrap' }), seeded(1));
    // volume 300 / 240 = 125 → crit ×2 = 250 → ×1.3 = 325
    expect(amrap).toMatchObject({ damage: 325, crit: true, finishCard: true });
  });

  it('mastery adds a small bonus; junk volume deals nothing', () => {
    expect(strike(fightRun([enemy()]), hit({ masteryLevel: 5 }), seeded(1)).damage).toBe(110);
    expect(strike(fightRun([enemy()]), hit({ junk: true }), seeded(1)).damage).toBe(0);
  });

  it('warm-ups heal and shield a little, a few times per fight, without ending the turn', () => {
    let run = { ...fightRun([enemy()]), hp: 50 };
    for (let i = 0; i < config.warmup.perFight + 2; i++) run = strike(run, hit({ isWarmup: true }), seeded(i)).run;
    expect(run.hp).toBe(50 + config.warmup.heal * config.warmup.perFight);
    expect(run.block).toBe(config.warmup.shield * config.warmup.perFight);
    expect(run.fight!.turn).toBe(0);
  });

  it('superset: the first card holds the turn, the second (opposite group) hits the other enemy', () => {
    const run = fightRun([enemy({ id: 'a' }), enemy({ id: 'b', kind: 'wraith', name: 'Rope Wraith', weakness: ['back'] })]);
    const first = strike(run, hit({ modifier: 'superset' }), seeded(1));
    expect(first.run.fight!.turn).toBe(0);
    expect(first.targetId).toBe('a');
    const second = strike(first.run, hit({ exerciseId: 'barbell_row', now: NOW + 60_000 }), seeded(2));
    expect(second.targetId).toBe('b');
    expect(second.run.fight!.turn).toBe(1);
    expect(second.run.fight!.supersetRestFor).toBe(NOW + 60_000);
  });

  it('targets the chosen enemy if the card can hit it', () => {
    const f = fightRun([enemy({ id: 'a', hp: 100 }), enemy({ id: 'b' })]).fight!;
    expect(pickTarget('bench_press', f)!.id).toBe('a');
    expect(pickTarget('bench_press', { ...f, targetId: 'b' })!.id).toBe('b');
  });
});

describe('rest overrun attacks', () => {
  const attacker = enemy({ intents: [{ type: 'attack', value: 10 }, idle, idle] });
  const restStart = NOW;
  const late = NOW + (config.rest.compound.max + config.rest.grace + 1) * 1000;
  const onTime = NOW + config.rest.compound.max * 1000;
  const rest = (now: number) => ({ startedAt: restStart, exerciseId: 'bench_press', now });

  it('only lands when the rest window + grace is overrun, once', () => {
    const run = fightRun([attacker]);
    expect(resolveOverrun(run, rest(onTime)).hurt).toBe(0);
    const r = resolveOverrun(run, rest(late));
    expect(r.hurt).toBe(10);
    expect(r.run.hp).toBe(90);
    expect(resolveOverrun(r.run, rest(late + 5000)).hurt).toBe(0);
  });

  it('shield absorbs first; counter reflects', () => {
    let run = { ...fightRun([attacker]), block: 6 };
    run = { ...run, fight: { ...run.fight!, counterFor: restStart } };
    const r = resolveOverrun(run, rest(late));
    expect(r.hurt).toBe(4);
    expect(r.run.block).toBe(0);
    expect(r.run.fight!.enemies[0].hp).toBe(300 - config.restCards.counter);
  });

  it('hurts more after a superset; never in Training Grounds', () => {
    const run = fightRun([attacker]);
    const sup = { ...run, fight: { ...run.fight!, supersetRestFor: restStart } };
    expect(resolveOverrun(sup, rest(late)).hurt).toBe(15);
    expect(resolveOverrun({ ...run, mode: 'training' }, rest(late)).hurt).toBe(0);
  });

  it('at 0 HP the fight is lost but you get back up', () => {
    const r = resolveOverrun({ ...fightRun([attacker]), hp: 5 }, rest(late));
    expect(r.knockout).toBe(true);
    expect(r.run.hp).toBe(config.combat.knockoutRecoverHp);
    expect(r.run.fight!.knockedOut).toBe(true);
  });
});

describe('rest cards', () => {
  it('one per rest period, never touching fatigue', () => {
    let run = { ...fightRun([enemy()]), hp: 50 };
    run = { ...run, fight: { ...run.fight!, restOffer: ['heal', 'shield', 'read'] } };
    const healed = playRestCard(run, 'heal', NOW, NOW);
    expect(healed.hp).toBe(50 + config.restCards.heal);
    expect(playRestCard(healed, 'shield', NOW, NOW)).toBe(healed);
    const next = playRestCard(healed, 'shield', NOW + 1, NOW + 1);
    expect(next.block).toBe(config.restCards.shield);
    expect(playRestCard(run, 'water', NOW, NOW)).toBe(run); // not offered
    const read = playRestCard(run, 'read', NOW, NOW);
    expect(read.fight!.revealUntilTurn).toBe(config.restCards.readIntentTurns);
  });
});

describe('bosses', () => {
  const lb = (v: number) => toKg(v, 'lb');
  const history: LoggedSet[] = [{ sessionId: 1, exerciseId: 'bench_press', weightKg: lb(155), reps: 5, isWarmup: false, loggedAt: 1 }];
  const wp = computeWeakPoint('bench', history, {}, 'lb');
  const bossRun = () => fightRun([createBoss('bench', wp, seeded(1))]);
  const intentsIdle = (r: RunState): RunState => ({
    ...r,
    fight: { ...r.fight!, enemies: r.fight!.enemies.map((e) => ({ ...e, intents: [idle, idle, idle] })) },
  });

  it('accessories deal 25% to boss armor; the compound below threshold deals normal damage', () => {
    const run = intentsIdle(bossRun());
    expect(strike(run, hit({ exerciseId: 'dumbbell_bench_press', weightKg: 20, reps: 10, baseline: 200 }), seeded(1)).damage).toBe(25);
    const weak = strike(run, hit({ weightKg: lb(135), reps: 5, baseline: lb(135) * 5 }), seeded(1));
    expect(weak.damage).toBe(100);
    expect(weak.run.fight!.enemies[0].armorBroken).toBe(false);
  });

  it('meeting the weak point shatters the armor for ×3', () => {
    const run = intentsIdle(bossRun());
    const r = strike(run, hit({ weightKg: wp.targetWeightKg, reps: 3, baseline: wp.targetWeightKg * 3 }), seeded(1));
    expect(r.run.fight!.enemies[0].armorBroken).toBe(true);
    expect(r.damage).toBe(300);
    expect(r.crit).toBe(true);
  });

  it('escapes if the armor holds after enough sets', () => {
    let run = intentsIdle(bossRun());
    let outcome;
    for (let i = 0; i < config.boss.escapeAfterSets; i++) {
      const r = strike(intentsIdle(run), hit({ exerciseId: 'cable_fly', weightKg: 10, reps: 12, baseline: 120 }), seeded(i));
      run = r.run;
      outcome = r.outcome;
    }
    expect(outcome).toBe('escaped');
  });
});

describe('run flow', () => {
  it('moves only to reachable nodes and resolves fights into rewards or the map', () => {
    const map = generateMap(seeded(5), { length: 5 });
    let run = newRun({ mode: 'run', map, bossLift: 'squat' });
    const far = map.find((n) => n.layer === 2)!;
    expect(canEnter(run, far.id)).toBe(false);
    const first = reachable(map, null)[0];
    run = enterNode(run, first.id, { fight: makeFight(first.id, [enemy()], seeded(1)) });
    expect(run.phase).toBe('node');
    const won = finishFight(run, 'victory', { cards: ['leg_press', 'cable_curl'], charge: true });
    expect(won.phase).toBe('reward');
    const after = takeReward(won, { card: 'leg_press' });
    expect(after.runCards).toEqual(['leg_press']);
    expect(after.charges).toBe(run.charges + 1);
    expect(after.phase).toBe('map');
    expect(finishFight(run, 'knockout').phase).toBe('map');
  });

  it('records boss outcomes and ends the run', () => {
    const map = generateMap(seeded(6), { length: 5 });
    const bossNode = map.find((n) => n.type === 'boss')!;
    const boss = createBoss('bench', computeWeakPoint('bench', [], {}, 'lb'), seeded(1));
    const base: RunState = { ...newRun({ mode: 'run', map, bossLift: 'bench' }), nodeId: bossNode.id, phase: 'node' };
    const withFight = (e: Enemy) => ({ ...base, fight: makeFight(bossNode.id, [e], seeded(1)) });
    expect(finishFight(withFight(boss), 'fled')).toMatchObject({ phase: 'end', bossOutcome: 'escaped' });
    expect(finishFight(withFight({ ...boss, armorBroken: true }), 'fled')).toMatchObject({ phase: 'end', bossOutcome: 'broken' });
    const won = finishFight(withFight(boss), 'victory', { cards: [], charge: true });
    expect(won.bossOutcome).toBe('defeated');
    expect(takeReward(won, {}).phase).toBe('end');
  });

  it('campfire restores HP', () => {
    const map = generateMap(seeded(7), { length: 5 });
    const camp = map.find((n) => n.type === 'campfire')!;
    const run: RunState = { ...newRun({ mode: 'run', map }), nodeId: camp.id, phase: 'node', hp: 30 };
    expect(restAtCampfire(run).hp).toBe(30 + config.combat.playerMaxHp * config.campfire.healPct);
  });

  it('drops prefer muscles below their zone and skip the core deck', () => {
    const meters = muscleMeters([], [], NOW);
    const drops = dropCandidates({ deck: ['bench_press'], runCards: [], equipment: ALL_EQUIPMENT, meters, rng: seeded(3) });
    expect(drops).toHaveLength(config.rewards.cardChoices);
    expect(drops).not.toContain('bench_press');
    expect(new Set(drops).size).toBe(drops.length);
    expect(MUSCLES.length).toBe(8);
  });
});

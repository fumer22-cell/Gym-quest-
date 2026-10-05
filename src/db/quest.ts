/**
 * Run ("quest") orchestration: everything that changes a session's run state or the permanent
 * profile in response to the player. Pure rules live in src/logic/run; this file loads what they
 * need, applies them, and saves the result.
 */
import { config } from '../config';
import { EXERCISES, getExercise } from '../data/exercises';
import { allInZone, lockedBy } from '../logic/fatigue';
import { addRunCard, ensureInHand, finishCard, isAvailable, refreshForFight, type DealContext, type HandState, type Rng } from '../logic/hand';
import { masteryLevel } from '../logic/mastery';
import { canUseModifier, unlockedModifiers } from '../logic/modifiers';
import { accessoriesFor, compoundFor, computeWeakPoint, learnRatios, nemesisReady, predictCompound1RM } from '../logic/readiness';
import { living, matchOn, playableOn, playRestCard, resolveOverrun, strike } from '../logic/run/combat';
import { BOSS_FOR_LIFT, bossWeakness, createBoss, createNemesisEnemy, nemesisName, spawnEnemies } from '../logic/run/enemies';
import { fightsAhead, generateMap, nodeById, trainingMap } from '../logic/run/map';
import { dropCandidates } from '../logic/run/rewards';
import { canEnter, enterNode, finishFight, makeFight, newRun, restAtCampfire, takeReward, type FightOutcome } from '../logic/run/run';
import { epley1RM, type SetEvaluation } from '../logic/strength';
import type {
  BossLift, LoggedSet, ModifierId, Nemesis, RestCardId, RewardOffer, RunState, Session, Settings, WeakPoint,
} from '../types';
import { db } from './db';
import { allHistoryFor, dealContext, getMeters, getSettings, setsForSession, updateSettings } from './queries';
import { notify } from './sync';

const LIFTS: BossLift[] = ['bench', 'squat', 'deadlift', 'ohp'];

export function handOf(s: Session): HandState {
  return { hand: s.hand, drawPile: s.drawPile, discard: s.discard, swappedOut: s.swappedOut };
}

export async function historyForLift(lift: BossLift): Promise<LoggedSet[]> {
  const ids = [compoundFor(lift).id, ...accessoriesFor(lift).map((e) => e.id)];
  return (await Promise.all(ids.map(allHistoryFor))).flat();
}

/** A new run: Training Grounds until calibrated, then a branching quest with a rotating boss. */
export async function buildRun(settings: Settings, rng: Rng, now = Date.now()): Promise<RunState> {
  if (!settings.calibrated) return newRun({ mode: 'training', map: trainingMap() });
  const ratios = settings.ratios ?? {};
  // A boss is only fair if its muscles have room for a real fight today.
  const meters = await getMeters(undefined, now);
  const fresh = (l: BossLift) => bossWeakness(l).every((m) => config.volume.fatigueCap - meters[m].fatigue >= config.boss.sets);
  const equipped = LIFTS.filter((l) => isAvailable(compoundFor(l), settings.equipment));
  const doable = equipped.filter(fresh).length ? equipped.filter(fresh) : equipped;
  let nemesis: Nemesis | undefined;
  for (const n of settings.nemeses ?? []) {
    if (n.defeatedAt || !doable.includes(n.lift)) continue;
    if (nemesisReady(n, await historyForLift(n.lift), ratios)) {
      nemesis = n;
      break;
    }
  }
  const rotated = doable.filter((l) => l !== settings.lastBossLift && l !== nemesis?.lift);
  const pool = rotated.length ? rotated : doable.length ? doable : LIFTS;
  const bossLift = pool[Math.floor(rng() * pool.length)];
  return newRun({ mode: 'run', map: generateMap(rng, { nemesis: !!nemesis }), bossLift, nemesisId: nemesis?.id });
}

/** Older sessions (from before runs existed) get a run attached when resumed. */
export async function ensureRun(sessionId: number, rng: Rng = Math.random): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session || session.run || session.endedAt) return;
  await db.sessions.update(sessionId, { run: await buildRun(await getSettings(), rng) });
  notify.session(sessionId);
}

async function weakPointFor(lift: BossLift, settings: Settings): Promise<WeakPoint> {
  const wp = computeWeakPoint(lift, await historyForLift(lift), settings.ratios ?? {}, settings.unit);
  if (isAvailable(getExercise(wp.exerciseId), settings.equipment)) return wp;
  // No barbell for the boss lift: any honest set of the closest available press/pull breaks it.
  const alt = accessoriesFor(lift).find((e) => isAvailable(e, settings.equipment));
  return alt ? { ...wp, exerciseId: alt.id, calibration: true, predictedE1rm: null, sources: [] } : wp;
}

async function nemesisWeakPoint(n: Nemesis, settings: Settings): Promise<WeakPoint> {
  const { predicted, sources } = predictCompound1RM(n.lift, await historyForLift(n.lift), settings.ratios ?? {});
  return {
    lift: n.lift,
    exerciseId: compoundFor(n.lift).id,
    targetWeightKg: n.targetWeightKg,
    targetReps: n.targetReps,
    thresholdE1rm: epley1RM(n.targetWeightKg, config.boss.minReps),
    predictedE1rm: predicted,
    calibration: false,
    sources,
  };
}

/** Dealing rules in a fight: cards whose primary muscle hits a living enemy's weakness. */
export async function fightContext(settings: Settings, sessionId: number, run: RunState, rng: Rng, now: number): Promise<DealContext> {
  const base = await dealContext(settings, sessionId, rng, now);
  const f = run.phase === 'node' ? run.fight : undefined;
  if (!f) return base;
  return {
    ...base,
    playable: (id) => living(f).some((e) => matchOn(id, e) === 'primary'),
    wanted: living(f).flatMap((e) => e.weakness),
  };
}

/** Refill the hand for the current fight, falling back to cards that only graze a weakness. */
async function refreshHand(hand: HandState, settings: Settings, sessionId: number, run: RunState, rng: Rng, now: number, keep?: string) {
  const f = run.phase === 'node' ? run.fight : undefined;
  if (!f) return hand;
  const ctx = await fightContext(settings, sessionId, run, rng, now);
  // While a boss's armor holds, the card that can break it is always in hand.
  const boss = living(f).find((e) => e.isBoss && !e.armorBroken && e.weakPoint);
  const wpCard = boss?.weakPoint?.exerciseId;
  const pinned =
    wpCard && !hand.swappedOut.includes(wpCard) && !ctx.isLocked?.(wpCard) && isAvailable(getExercise(wpCard), settings.equipment)
      ? wpCard
      : undefined;
  const base = pinned && keep !== pinned ? ensureInHand(hand, pinned) : hand;
  const refreshed = refreshForFight(base, ctx, keep ?? pinned, (id) => playableOn(id, f));
  return pinned && keep && keep !== pinned ? ensureInHand(refreshed, pinned) : refreshed;
}

async function save(sessionId: number, patch: Partial<Session>, settingsPatch?: Partial<Settings>) {
  await db.sessions.update(sessionId, patch);
  notify.session(sessionId);
  if (settingsPatch && Object.keys(settingsPatch).length) await updateSettings(settingsPatch);
}

async function load(sessionId: number) {
  const [session, settings] = await Promise.all([db.sessions.get(sessionId), getSettings()]);
  return { session, settings, run: session?.run };
}

/** Step onto a map node: spawn its enemies, treasure or campfire. */
export async function enterMapNode(sessionId: number, nodeId: string, rng: Rng = Math.random, now = Date.now()) {
  const { session, settings, run } = await load(sessionId);
  if (!session || !run || !canEnter(run, nodeId)) return;
  const node = nodeById(run.map, nodeId)!;
  const meters = await getMeters(sessionId, now);
  let next: RunState;
  if (node.type === 'treasure') {
    const reward: RewardOffer = {
      cards: dropCandidates({ deck: settings.deck, runCards: run.runCards, equipment: settings.equipment, meters, rng, n: config.rewards.treasureCardChoices }),
      charge: true,
      treasure: true,
    };
    next = enterNode(run, nodeId, { reward });
  } else if (node.type === 'campfire') {
    next = enterNode(run, nodeId);
  } else if (node.type === 'boss') {
    const lift = run.bossLift ?? 'bench';
    next = enterNode(run, nodeId, { fight: makeFight(nodeId, [createBoss(lift, await weakPointFor(lift, settings), rng)], rng) });
  } else {
    const nemesis = node.type === 'nemesis' ? (settings.nemeses ?? []).find((n) => n.id === run.nemesisId && !n.defeatedAt) : undefined;
    const enemies = nemesis
      ? [createNemesisEnemy(nemesis, await nemesisWeakPoint(nemesis, settings), rng)]
      : spawnEnemies(meters, rng, {
          idPrefix: nodeId,
          fightsLeft: 1 + fightsAhead(run.map, nodeId),
          training: run.mode === 'training',
          reserve: run.bossLift ? { muscles: bossWeakness(run.bossLift), sets: config.boss.sets } : undefined,
          canTrain: (m) =>
            EXERCISES.some((e) => e.primaryMuscles.includes(m) && isAvailable(e, settings.equipment) && !lockedBy(e, meters)),
        });
    if (enemies.length === 0) {
      const cleared = enterNode(run, nodeId);
      next = {
        ...cleared,
        phase: cleared.map.find((n) => n.id === nodeId)!.next.length ? 'map' : 'end',
        log: [...run.log, 'Your muscles are spent. Nothing here is worth junk volume.'].slice(-20),
      };
    } else {
      next = enterNode(run, nodeId, { fight: makeFight(nodeId, enemies, rng) });
    }
  }
  const hand = await refreshHand(handOf(session), settings, sessionId, next, rng, now);
  await save(sessionId, { run: next, ...hand, activeExerciseId: undefined });
}

/** Best compound e1RM thrown at a boss this session, and what it teaches the readiness formula. */
async function bossConsequences(
  sessionId: number,
  before: RunState,
  after: RunState,
  settings: Settings,
  now: number,
  rng: Rng,
  extra?: LoggedSet,
): Promise<Partial<Settings>> {
  const boss = before.fight?.enemies.find((e) => e.isBoss);
  const node = nodeById(before.map, before.nodeId);
  if (!boss?.weakPoint || !node) return {};
  const wp = boss.weakPoint;
  const sets = [...(await setsForSession(sessionId)), ...(extra ? [extra] : [])].filter(
    (s) => s.targetEnemyId === boss.id && s.exerciseId === wp.exerciseId && !s.isWarmup,
  );
  const patch: Partial<Settings> = {};
  const best = sets.length ? Math.max(...sets.map((s) => epley1RM(s.weightKg, s.reps))) : 0;
  if (best > 0) patch.ratios = learnRatios(wp, best, settings.ratios ?? {});
  const nemeses = [...(settings.nemeses ?? [])];
  // Only a real attempt at the weak point turns an escaped boss into a nemesis.
  if (node.type === 'boss' && after.bossOutcome === 'escaped' && !wp.calibration && sets.length > 0) {
    const kind = BOSS_FOR_LIFT[wp.lift];
    nemeses.push({
      id: `nm${now}`,
      name: nemesisName(kind.name, rng),
      kind: kind.kind,
      lift: wp.lift,
      targetWeightKg: wp.targetWeightKg,
      targetReps: wp.targetReps,
      escapedAt: now,
      attempts: 1,
    });
    patch.nemeses = nemeses;
  }
  if (node.type === 'nemesis' && boss.nemesisId) {
    patch.nemeses = nemeses.map((n) =>
      n.id !== boss.nemesisId ? n : after.nemesisOutcome === 'defeated' ? { ...n, defeatedAt: now } : { ...n, attempts: n.attempts + 1 },
    );
    if (after.nemesisOutcome === 'defeated') patch.modifierProgress = (settings.modifierProgress ?? 0) + 2;
  }
  return patch;
}

async function concludeFight(
  session: Session,
  run: RunState,
  outcome: FightOutcome,
  settings: Settings,
  now: number,
  rng: Rng,
  extra?: LoggedSet,
): Promise<{ run: RunState; settingsPatch: Partial<Settings> }> {
  const node = nodeById(run.map, run.nodeId);
  let reward: RewardOffer | undefined;
  if (outcome === 'victory') {
    const meters = await getMeters(session.id!, now);
    const big = node?.type === 'boss' || node?.type === 'nemesis';
    reward = {
      cards: dropCandidates({ deck: settings.deck, runCards: run.runCards, equipment: settings.equipment, meters, rng }),
      charge: big || rng() < config.rewards.chargeChance,
      nemesisSlain: node?.type === 'nemesis',
    };
  }
  const next = finishFight(run, outcome, reward);
  const settingsPatch = await bossConsequences(session.id!, run, next, settings, now, rng, extra);
  return { run: next, settingsPatch };
}

export interface FightSetResult {
  damage: number;
  targetId?: string;
  modifier?: ModifierId;
  patch: Partial<Session>;
  settingsPatch?: Partial<Settings>;
}

/** Called by logSet when the session has a run: the set becomes a turn of the fight. */
export async function applyFightSet(
  session: Session,
  set: LoggedSet,
  ctx: { evaluation: SetEvaluation; history: LoggedSet[]; plannedReps: number; locked: boolean },
  now: number,
  rng: Rng,
): Promise<FightSetResult> {
  let run = session.run!;
  const settings = await getSettings();
  const none: FightSetResult = { damage: 0, patch: {} };
  if (run.phase !== 'node' || !run.fight) return none;
  const ex = getExercise(set.exerciseId);

  // An overrun attack from the previous rest lands before this set.
  if (session.restStartedAt && session.restExerciseId && !set.isWarmup) {
    const o = resolveOverrun(run, { startedAt: session.restStartedAt, exerciseId: session.restExerciseId, now });
    run = o.run;
    if (o.knockout) {
      const c = await concludeFight(session, run, 'knockout', settings, now, rng);
      return { damage: 0, patch: { run: c.run, activeExerciseId: undefined }, settingsPatch: c.settingsPatch };
    }
  }

  let modifier = set.modifier;
  if (modifier && (run.charges <= 0 || !canUseModifier(ex, modifier, unlockedModifiers(settings.modifierProgress ?? 0)))) {
    modifier = undefined;
  }
  const r = strike(
    run,
    {
      exerciseId: set.exerciseId,
      weightKg: set.weightKg,
      reps: set.reps,
      isWarmup: set.isWarmup,
      modifier,
      baseline: ctx.evaluation.baseline,
      isPR: ctx.evaluation.isPR,
      plannedReps: ctx.plannedReps,
      masteryLevel: masteryLevel(ex, ctx.history),
      junk: ctx.locked,
      now,
    },
    rng,
  );
  run = r.run;
  let hand = handOf(session);
  let activeExerciseId = session.activeExerciseId;
  if (r.disrupt && run.fight) {
    const options = hand.hand.filter((id) => id !== set.exerciseId);
    if (options.length) run = { ...run, fight: { ...run.fight, disrupted: options[Math.floor(rng() * options.length)] } };
  }
  let settingsPatch: Partial<Settings> | undefined;
  const scored: LoggedSet = { ...set, modifier, targetEnemyId: r.targetId };
  // Every enemy left is weak only to capped muscles: you've done enough, the fight is won.
  let outcome = r.outcome;
  if (!outcome && run.fight) {
    const after = await getMeters(session.id!, now);
    const spent = living(run.fight).filter((e) => !e.isBoss).every((e) => e.weakness.every((m) => after[m].status === 'cap'));
    if (spent && living(run.fight).every((e) => !e.isBoss)) {
      outcome = 'victory';
      run = { ...run, log: [...run.log, 'Worn down! Those muscles hit their cap, so the fight is yours.'].slice(-20) };
    }
  }
  if (outcome) {
    const c = await concludeFight(session, run, outcome, settings, now, rng, scored);
    run = c.run;
    settingsPatch = c.settingsPatch;
    activeExerciseId = undefined;
  }
  const deal = await fightContext(settings, session.id!, run, rng, now);
  // AMRAP ends the exercise; so does killing the last enemy this card can hit, or capping its muscle.
  const stranded = !!activeExerciseId && !!run.fight && !playableOn(activeExerciseId, run.fight);
  const capped = !!activeExerciseId && !!deal.isLocked?.(activeExerciseId);
  if ((r.finishCard || stranded || capped) && activeExerciseId) {
    hand = finishCard(hand, activeExerciseId, deal);
    activeExerciseId = undefined;
  }
  hand = await refreshHand(hand, settings, session.id!, run, rng, now, activeExerciseId);
  return { damage: r.damage, targetId: r.targetId, modifier, patch: { run, ...hand, activeExerciseId }, settingsPatch };
}

/** Called while resting: an Attack lands the moment the rest window + grace is overrun. */
export async function checkOverrun(sessionId: number, rng: Rng = Math.random, now = Date.now()) {
  const { session, settings, run } = await load(sessionId);
  if (!session || !run?.fight || !session.restStartedAt || !session.restExerciseId) return null;
  const o = resolveOverrun(run, { startedAt: session.restStartedAt, exerciseId: session.restExerciseId, now });
  if (o.run === run) return null;
  if (o.knockout) {
    const c = await concludeFight(session, o.run, 'knockout', settings, now, rng);
    await save(sessionId, { run: c.run, activeExerciseId: undefined }, c.settingsPatch);
  } else {
    await save(sessionId, { run: o.run });
  }
  return o;
}

export async function playRest(sessionId: number, card: RestCardId, now = Date.now()) {
  const { session, run } = await load(sessionId);
  if (!session || !run || !session.restStartedAt) return;
  const next = playRestCard(run, card, session.restStartedAt, now);
  if (next !== run) await save(sessionId, { run: next });
}

export async function setTarget(sessionId: number, enemyId: string) {
  const { run } = await load(sessionId);
  if (!run?.fight || !run.fight.enemies.some((e) => e.id === enemyId && e.hp > 0)) return;
  await save(sessionId, { run: { ...run, fight: { ...run.fight, targetId: enemyId } } });
}

/** Leave a fight early. No rewards; a boss with its armor intact escapes. */
export async function fleeFight(sessionId: number, rng: Rng = Math.random, now = Date.now()) {
  const { session, settings, run } = await load(sessionId);
  if (!session || !run?.fight) return;
  const c = await concludeFight(session, run, 'fled', settings, now, rng);
  await save(sessionId, { run: c.run, activeExerciseId: undefined }, c.settingsPatch);
}

export async function claimReward(sessionId: number, pick: { card?: string; charge?: boolean }) {
  const { session, run } = await load(sessionId);
  if (!session || !run) return;
  const next = takeReward(run, pick);
  const hand = pick.card && next.runCards.includes(pick.card) ? addRunCard(handOf(session), pick.card) : handOf(session);
  await save(sessionId, { run: next, ...hand });
}

export async function restAtCamp(sessionId: number) {
  const { run } = await load(sessionId);
  if (!run) return;
  await save(sessionId, { run: restAtCampfire(run) });
}

/** Stop the run here (the workout can end any time). A boss with intact armor escapes. */
export async function abandonRun(sessionId: number, rng: Rng = Math.random, now = Date.now()) {
  const { session, settings, run } = await load(sessionId);
  if (!session || !run || run.phase === 'end') return;
  let next = run;
  let settingsPatch: Partial<Settings> | undefined;
  if (run.fight && run.phase === 'node') {
    const c = await concludeFight(session, run, 'fled', settings, now, rng);
    next = c.run;
    settingsPatch = c.settingsPatch;
  }
  await save(sessionId, { run: { ...next, phase: 'end', fight: undefined, reward: undefined }, activeExerciseId: undefined }, settingsPatch);
}

/**
 * End of run: keep one dropped card (swapping one out at the deck cap), record progress, and
 * close the session.
 */
export async function finishRun(sessionId: number, choice: { keep?: string; remove?: string } = {}, now = Date.now()) {
  const { session, run } = await load(sessionId);
  if (!session || !run) return { cleared: false };
  if (run.phase !== 'end') {
    await abandonRun(sessionId, Math.random, now);
    return finishRun(sessionId, choice, now);
  }
  const fresh = await getSettings();
  const meters = await getMeters(sessionId, now);
  const cleared = run.mode === 'run' && allInZone(meters) && !!run.bossOutcome;
  let deck = fresh.deck;
  if (choice.keep && run.runCards.includes(choice.keep) && !deck.includes(choice.keep)) {
    if (deck.length < config.deck.maxSize) deck = [...deck, choice.keep];
    else if (choice.remove && deck.includes(choice.remove)) deck = deck.map((d) => (d === choice.remove ? choice.keep! : d));
  }
  const kept = deck.includes(choice.keep ?? '') ? choice.keep : undefined;
  await updateSettings({
    deck,
    calibrated: fresh.calibrated || run.mode === 'training',
    runsCleared: (fresh.runsCleared ?? 0) + (cleared ? 1 : 0),
    modifierProgress: (fresh.modifierProgress ?? 0) + (cleared ? 1 : 0),
    lastBossLift: run.bossLift ?? fresh.lastBossLift,
  });
  await db.sessions.update(sessionId, {
    run: { ...run, keptCard: kept, cleared },
    endedAt: now,
    activeExerciseId: undefined,
    restStartedAt: undefined,
    restExerciseId: undefined,
  });
  notify.session(sessionId);
  return { cleared };
}

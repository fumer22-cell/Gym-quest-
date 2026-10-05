import { config } from '../../config';
import { getExercise } from '../../data/exercises';
import type { CombatEvent, Enemy, FightState, Intent, ModifierId, RestCardId, RunState } from '../../types';
import type { Rng } from '../hand';
import { masteryBonus } from '../mastery';
import { areOpposite } from '../modifiers';
import { meetsWeakPoint } from '../readiness';
import { restWindow } from '../rest';
import { computeDamage, setVolume, weaknessMatch, type WeaknessMatch } from '../strength';
import { rollIntent } from './enemies';

export const living = (f: FightState) => f.enemies.filter((e) => e.hp > 0);

export function currentIntent(e: Enemy): Intent {
  return e.intents[0] ?? { type: 'idle', value: 0 };
}

/** Best match of a card against an enemy's weaknesses. */
export function matchOn(exerciseId: string, e: Enemy): WeaknessMatch {
  const ex = getExercise(exerciseId);
  let best: WeaknessMatch = 'none';
  for (const m of e.weakness) {
    const w = weaknessMatch(ex, m);
    if (w === 'primary') return 'primary';
    if (w === 'secondary') best = 'secondary';
  }
  return best;
}

export function playableOn(exerciseId: string, f: FightState | undefined): boolean {
  if (!f) return true;
  return living(f).some((e) => matchOn(exerciseId, e) !== 'none');
}

/** The enemy a card will hit: the chosen target if it can, else the best match (then lowest HP). */
export function pickTarget(exerciseId: string, f: FightState, avoidId?: string): Enemy | undefined {
  const options = living(f).filter((e) => matchOn(exerciseId, e) !== 'none');
  const chosen = options.find((e) => e.id === f.targetId && e.id !== avoidId);
  if (chosen) return chosen;
  const rank = (e: Enemy) => (matchOn(exerciseId, e) === 'primary' ? 0 : 1);
  const sorted = [...options].sort((a, b) => rank(a) - rank(b) || a.hp - b.hp);
  return sorted.find((e) => e.id !== avoidId) ?? sorted[0];
}

const REST_POOL: [RestCardId, number][] = [
  ['shield', 3],
  ['heal', 3],
  ['regen', 2],
  ['counter', 2],
  ['read', 2],
  ['water', 1],
  ['breathing', 1],
];

export function rollRestOffer(rng: Rng): RestCardId[] {
  const pool = [...REST_POOL];
  const out: RestCardId[] = [];
  while (out.length < config.restCards.offered && pool.length) {
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    const i = pool.findIndex(([, w]) => (r -= w) < 0);
    out.push(pool[i][0]);
    pool.splice(i, 1);
  }
  return out;
}

export interface StrikeInput {
  exerciseId: string;
  weightKg: number;
  reps: number;
  isWarmup: boolean;
  modifier?: ModifierId;
  baseline: number | null;
  isPR: boolean;
  /** Reps planned before the set (AMRAP measures against this). */
  plannedReps: number;
  masteryLevel: number;
  /** The card is locked by fatigue: junk volume, no damage. */
  junk: boolean;
  now: number;
}

export interface StrikeResult {
  run: RunState;
  damage: number;
  targetId?: string;
  crit: boolean;
  /** A new Disrupt intent is active: the caller locks a random hand card. */
  disrupt: boolean;
  /** AMRAP ends the exercise. */
  finishCard: boolean;
  outcome?: 'victory' | 'escaped';
  /** Best compound e1RM thrown at a boss this set (for ratio learning). */
  bossAttempt?: boolean;
}

function event(e: Omit<CombatEvent, 'at'>, now: number): CombatEvent {
  return { ...e, at: now };
}

function pushLog(run: RunState, text: string): string[] {
  return [...run.log, text].slice(-20);
}

/** Damage for one set against one enemy, before it is applied. */
export function setDamage(input: StrikeInput, target: Enemy): { damage: number; crit: boolean; armorBreak: boolean } {
  const ex = getExercise(input.exerciseId);
  const match = matchOn(input.exerciseId, target);
  const m = config.modifiers;
  let dmg = computeDamage({ volume: setVolume(ex, input), baseline: input.baseline, isPR: input.isPR, match });
  let crit = input.isPR && match !== 'none';
  if (input.modifier === 'amrap') {
    const extra = Math.max(0, input.reps - input.plannedReps);
    if (!input.isPR && extra >= m.amrap.critExtraReps) {
      dmg *= config.damage.critMultiplier;
      crit = true;
    }
    dmg *= 1 + m.amrap.perExtraRep * extra;
  }
  if (input.modifier === 'dropset') dmg *= m.dropset.damage;
  if (input.modifier === 'paused') dmg *= m.paused.damage;
  dmg *= 1 + masteryBonus(input.masteryLevel);
  // Armor intent blunts unmodified cards only.
  if (currentIntent(target).type === 'armor' && !input.modifier) dmg *= 1 - config.combat.armorReduction;
  let armorBreak = false;
  if (target.isBoss && !target.armorBroken && target.weakPoint) {
    if (input.exerciseId === target.weakPoint.exerciseId) {
      if (meetsWeakPoint(target.weakPoint, { ...input, isWarmup: false })) {
        armorBreak = true;
        crit = true;
        dmg *= config.boss.armorBreakMultiplier;
      }
    } else {
      dmg *= config.boss.accessoryArmorMultiplier;
    }
  }
  if (input.junk || match === 'none') return { damage: 0, crit: false, armorBreak: false };
  return { damage: Math.round(dmg), crit, armorBreak };
}

/** Advance the fight one turn: enemies resolve their intents and telegraph new ones. */
function endTurn(f: FightState, run: RunState, rng: Rng, now: number): { f: FightState; run: RunState; disrupt: boolean; events: CombatEvent[] } {
  const events: CombatEvent[] = [];
  const training = run.mode === 'training';
  const enemies = f.enemies.map((e) => {
    if (e.hp <= 0) return e;
    let hp = e.hp;
    const intent = currentIntent(e);
    if (intent.type === 'regen') {
      hp = Math.min(e.maxHp, hp + intent.value);
      events.push(event({ kind: 'regen', enemyId: e.id, amount: hp - e.hp, text: `${e.name} regenerates ${hp - e.hp}` }, now));
    }
    return { ...e, hp, intents: [...e.intents.slice(1), rollIntent(rng, { boss: e.isBoss, training })] };
  });
  let hp = run.hp;
  let regenSets = run.regenSets;
  if (regenSets > 0) {
    hp = Math.min(run.maxHp, hp + config.restCards.regenPerSet);
    regenSets -= 1;
  }
  const disrupt = enemies.some((e) => e.hp > 0 && currentIntent(e).type === 'disrupt');
  return {
    f: { ...f, enemies, turn: f.turn + 1, disrupted: undefined, restOffer: rollRestOffer(rng) },
    run: { ...run, hp, regenSets },
    disrupt,
    events,
  };
}

/** Resolve one logged set inside the current fight. */
export function strike(run0: RunState, input: StrikeInput, rng: Rng): StrikeResult {
  const base: StrikeResult = { run: run0, damage: 0, crit: false, disrupt: false, finishCard: false };
  const f0 = run0.fight;
  if (!f0 || run0.phase !== 'node') return base;
  let run = run0;

  if (input.isWarmup) {
    const used = f0.warmups ?? 0;
    if (used >= config.warmup.perFight) return base;
    const hp = Math.min(run.maxHp, run.hp + config.warmup.heal);
    const ev = event({ kind: 'heal', amount: config.warmup.heal, text: `Warm-up: +${config.warmup.heal} HP, +${config.warmup.shield} shield` }, input.now);
    return {
      ...base,
      run: { ...run, hp, block: run.block + config.warmup.shield, fight: { ...f0, warmups: used + 1, lastEvent: ev } },
    };
  }

  if (input.modifier) run = { ...run, charges: Math.max(0, run.charges - 1) };
  const ex = getExercise(input.exerciseId);
  const sup = f0.superset;
  const isSecond = !!sup && sup.firstExerciseId !== input.exerciseId && areOpposite(getExercise(sup.firstExerciseId), ex);
  const target = pickTarget(input.exerciseId, f0, isSecond ? sup!.firstTargetId : undefined);

  let f: FightState = { ...f0 };
  const events: CombatEvent[] = [];
  let damage = 0;
  let crit = false;
  let bossAttempt = false;
  if (target) {
    const r = setDamage(input, target);
    damage = r.damage;
    crit = r.crit;
    bossAttempt = !!target.isBoss && input.exerciseId === target.weakPoint?.exerciseId;
    f.enemies = f.enemies.map((e) =>
      e.id === target.id
        ? {
            ...e,
            hp: Math.max(0, e.hp - damage),
            armorBroken: e.armorBroken || r.armorBreak,
            setsTaken: e.isBoss ? (e.setsTaken ?? 0) + 1 : e.setsTaken,
          }
        : e,
    );
    if (r.armorBreak) events.push(event({ kind: 'armor-break', enemyId: target.id, amount: damage, crit: true, text: `${target.name}'s armor shatters!` }, input.now));
    events.push(event({ kind: 'hit', enemyId: target.id, amount: damage, crit, text: `${ex.name} hits ${target.name} for ${damage}` }, input.now));
    if (f.enemies.find((e) => e.id === target.id)!.hp <= 0) {
      events.push(event({ kind: 'defeat', enemyId: target.id, text: `${target.name} is defeated!` }, input.now));
    }
  } else {
    events.push(event({ kind: 'info', text: `No enemy here is weak to ${ex.name}` }, input.now));
  }

  // Superset: the first card does not end the turn; the second (opposite group) completes it.
  if (input.modifier === 'superset' && !isSecond) {
    f.superset = { firstExerciseId: input.exerciseId, firstTargetId: target?.id };
    f.lastEvent = events[events.length - 1];
    run = { ...run, fight: f, log: pushLog(run, events.map((e) => e.text).join('. ')) };
    return { ...base, run, damage, targetId: target?.id, crit, bossAttempt, outcome: living(f).length === 0 ? 'victory' : undefined };
  }
  if (isSecond) {
    f.superset = undefined;
    f.supersetRestFor = input.now;
  } else if (sup) {
    // Any other card cancels a pending superset.
    f.superset = undefined;
  }

  const turn = endTurn(f, run, rng, input.now);
  f = turn.f;
  run = turn.run;
  events.push(...turn.events);

  let outcome: StrikeResult['outcome'];
  if (living(f).length === 0) outcome = 'victory';
  const boss = f.enemies.find((e) => e.isBoss && e.hp > 0);
  if (!outcome && boss && !boss.armorBroken && (boss.setsTaken ?? 0) >= config.boss.escapeAfterSets) {
    outcome = 'escaped';
    events.push(event({ kind: 'escape', enemyId: boss.id, text: `${boss.name} escapes into the dark!` }, input.now));
  }
  f.lastEvent = events.find((e) => e.kind === 'armor-break') ?? events.find((e) => e.kind === 'hit') ?? events[events.length - 1];
  run = { ...run, fight: f, log: pushLog(run, events.map((e) => e.text).join('. ')) };
  return {
    run,
    damage,
    targetId: target?.id,
    crit,
    disrupt: turn.disrupt && !outcome,
    finishCard: input.modifier === 'amrap',
    outcome,
    bossAttempt,
  };
}

/**
 * Attack intents land only if the rest window + grace is overrun (§7). Shield absorbs first,
 * Counter reflects. Idempotent per rest period.
 */
export function resolveOverrun(
  run: RunState,
  rest: { startedAt: number; exerciseId: string; now: number },
): { run: RunState; hurt: number; knockout: boolean } {
  const f = run.fight;
  const none = { run, hurt: 0, knockout: false };
  if (!f || run.phase !== 'node' || run.mode === 'training') return none;
  if (f.attackResolvedFor === rest.startedAt) return none;
  const w = restWindow(getExercise(rest.exerciseId));
  if (rest.now - rest.startedAt <= (w.max + config.rest.grace) * 1000) return none;
  const attackers = living(f).filter((e) => currentIntent(e).type === 'attack');
  if (attackers.length === 0) return { run: { ...run, fight: { ...f, attackResolvedFor: rest.startedAt } }, hurt: 0, knockout: false };

  const mult = f.supersetRestFor === rest.startedAt ? config.modifiers.superset.overrunMultiplier : 1;
  let raw = 0;
  for (const a of attackers) raw += Math.round(currentIntent(a).value * mult);
  const blocked = Math.min(run.block, raw);
  const hurt = raw - blocked;
  let enemies = f.enemies;
  const events: CombatEvent[] = [];
  if (f.counterFor === rest.startedAt) {
    enemies = enemies.map((e) => (attackers.some((a) => a.id === e.id) ? { ...e, hp: Math.max(0, e.hp - config.restCards.counter) } : e));
    events.push(event({ kind: 'counter', amount: config.restCards.counter, text: `Counter! ${config.restCards.counter} damage reflected` }, rest.now));
  }
  const hp = Math.max(0, run.hp - hurt);
  events.push(
    event({ kind: 'hurt', amount: hurt, text: blocked ? `Rest ran long: hit for ${raw}, ${blocked} blocked` : `Rest ran long: hit for ${hurt}` }, rest.now),
  );
  const knockout = hp <= 0;
  const nextFight: FightState = { ...f, enemies, attackResolvedFor: rest.startedAt, lastEvent: events[events.length - 1] };
  return {
    run: {
      ...run,
      hp: knockout ? config.combat.knockoutRecoverHp : hp,
      block: run.block - blocked,
      fight: { ...nextFight, knockedOut: knockout || f.knockedOut },
      log: pushLog(run, events.map((e) => e.text).join('. ')),
    },
    hurt,
    knockout,
  };
}

/** One rest card per rest period. Rest cards never touch fatigue. */
export function playRestCard(run: RunState, card: RestCardId, restStartedAt: number, now: number): RunState {
  const f = run.fight;
  if (!f || run.phase !== 'node') return run;
  if (f.restCardPlayedFor === restStartedAt || !f.restOffer.includes(card)) return run;
  const rc = config.restCards;
  let { hp, block, regenSets } = run;
  const nf: FightState = { ...f, restCardPlayedFor: restStartedAt };
  let text = '';
  switch (card) {
    case 'shield':
      block += rc.shield;
      text = `Shield +${rc.shield}`;
      break;
    case 'heal':
      hp = Math.min(run.maxHp, hp + rc.heal);
      text = `Heal +${rc.heal}`;
      break;
    case 'regen':
      regenSets = rc.regenSets;
      text = `Regen: +${rc.regenPerSet} HP for your next ${rc.regenSets} sets`;
      break;
    case 'counter':
      nf.counterFor = restStartedAt;
      text = `Counter ready: ${rc.counter} damage back if attacked this rest`;
      break;
    case 'read':
      nf.revealUntilTurn = f.turn + rc.readIntentTurns;
      text = `You read their next ${rc.readIntentTurns} moves`;
      break;
    case 'water':
      hp = Math.min(run.maxHp, hp + rc.waterHeal);
      text = `Sip of water +${rc.waterHeal} HP`;
      break;
    case 'breathing':
      block += rc.breathingShield;
      hp = Math.min(run.maxHp, hp + rc.breathingHeal);
      text = `Slow breathing: shield +${rc.breathingShield}, +${rc.breathingHeal} HP`;
      break;
  }
  nf.lastEvent = event({ kind: card === 'shield' || card === 'breathing' ? 'shield' : 'heal', text }, now);
  return { ...run, hp, block, regenSets, fight: nf, log: pushLog(run, text) };
}

export const REST_CARD_INFO: Record<RestCardId, { name: string; text: string; action?: string }> = {
  shield: { name: 'Shield', text: `Block ${config.restCards.shield} of the next attack.` },
  heal: { name: 'Heal', text: `Restore ${config.restCards.heal} HP.` },
  regen: { name: 'Regen', text: `+${config.restCards.regenPerSet} HP after each of your next ${config.restCards.regenSets} sets.` },
  counter: { name: 'Counter', text: `If attacked this rest, deal ${config.restCards.counter} back.` },
  read: { name: 'Read Intent', text: `See each enemy's next ${config.restCards.readIntentTurns} moves.` },
  water: { name: 'Sip Water', text: `Restore ${config.restCards.waterHeal} HP.`, action: 'Take a real sip of water.' },
  breathing: {
    name: 'Slow Breathing',
    text: `Shield +${config.restCards.breathingShield}, +${config.restCards.breathingHeal} HP.`,
    action: `Breathe slowly for ${config.restCards.breathingSeconds} seconds.`,
  },
};

export function restOverdue(exerciseId: string, startedAt: number, now: number): boolean {
  const w = restWindow(getExercise(exerciseId));
  return now - startedAt > (w.max + config.rest.grace) * 1000;
}

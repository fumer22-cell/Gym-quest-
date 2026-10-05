import { config } from '../../config';
import type { BossLift, Enemy, FightState, RewardOffer, RunState } from '../../types';
import type { Rng } from '../hand';
import { rollRestOffer } from './combat';
import { nodeById, reachable } from './map';

export function newRun(opts: {
  mode: RunState['mode'];
  map: RunState['map'];
  bossLift?: BossLift;
  nemesisId?: string;
  charges?: number;
}): RunState {
  return {
    mode: opts.mode,
    map: opts.map,
    nodeId: null,
    visited: [],
    phase: 'map',
    hp: config.combat.playerMaxHp,
    maxHp: config.combat.playerMaxHp,
    block: 0,
    regenSets: 0,
    charges: opts.charges ?? config.combat.startingModifierCharges,
    runCards: [],
    bossLift: opts.bossLift,
    nemesisId: opts.nemesisId,
    log: [],
  };
}

export function makeFight(nodeId: string, enemies: Enemy[], rng: Rng): FightState {
  // No preset target: each card hits its best match unless the player taps an enemy.
  return { nodeId, enemies, turn: 0, restOffer: rollRestOffer(rng) };
}

export function currentNode(run: RunState) {
  return nodeById(run.map, run.nodeId);
}

export function canEnter(run: RunState, nodeId: string): boolean {
  return run.phase === 'map' && reachable(run.map, run.nodeId).some((n) => n.id === nodeId);
}

/** Step onto a node. Fight-type nodes come with their enemies; treasure comes with its offer. */
export function enterNode(run: RunState, nodeId: string, extra: { fight?: FightState; reward?: RewardOffer } = {}): RunState {
  if (!canEnter(run, nodeId)) return run;
  const node = nodeById(run.map, nodeId)!;
  const base = { ...run, nodeId, visited: [...run.visited, nodeId], block: 0, fight: undefined, reward: undefined };
  if (node.type === 'treasure') return { ...base, phase: 'reward', reward: extra.reward };
  if (node.type === 'campfire') return { ...base, phase: 'node' };
  return { ...base, phase: 'node', fight: extra.fight };
}

export function isFinalNode(run: RunState): boolean {
  const node = currentNode(run);
  return !node || node.next.length === 0;
}

export type FightOutcome = 'victory' | 'escaped' | 'knockout' | 'fled';

/** Close the current fight. Losing costs rewards, never the workout (§2.3). */
export function finishFight(run: RunState, outcome: FightOutcome, reward?: RewardOffer): RunState {
  const node = currentNode(run);
  if (!node || !run.fight) return run;
  const boss = run.fight.enemies.find((e) => e.isBoss);
  const next: RunState = { ...run, fight: undefined, reward: undefined, block: 0 };
  const win = outcome === 'victory';
  if (node.type === 'boss') {
    next.bossOutcome = win ? 'defeated' : boss?.armorBroken ? 'broken' : 'escaped';
  }
  if (node.type === 'nemesis') next.nemesisOutcome = win ? 'defeated' : 'escaped';
  if (win && reward) return { ...next, phase: 'reward', reward };
  if (node.type === 'boss' || isFinalNode(run)) return { ...next, phase: 'end' };
  return { ...next, phase: 'map' };
}

/** Take a reward: a run card, a modifier charge, or skip. */
export function takeReward(run: RunState, pick: { card?: string; charge?: boolean }): RunState {
  if (run.phase !== 'reward' || !run.reward) return run;
  const r = run.reward;
  let { runCards, charges } = run;
  if (pick.card && r.cards.includes(pick.card)) runCards = [...runCards, pick.card];
  // A fight's charge drop comes on top of the card; at a treasure it replaces the card.
  if (r.charge && (!r.treasure || pick.charge)) charges += 1;
  if (r.nemesisSlain) charges += 1;
  const done = { ...run, runCards, charges, reward: undefined };
  return { ...done, phase: isFinalNode(run) ? 'end' : 'map' };
}

/** Campfire: a planned longer break that restores HP. */
export function restAtCampfire(run: RunState): RunState {
  const node = currentNode(run);
  if (node?.type !== 'campfire' || run.phase !== 'node') return run;
  const heal = Math.round(run.maxHp * config.campfire.healPct);
  return { ...run, hp: Math.min(run.maxHp, run.hp + heal), phase: 'map', log: [...run.log, `Rested at the campfire: +${heal} HP`].slice(-20) };
}

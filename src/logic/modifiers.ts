import { config } from '../config';
import type { Exercise, LoggedSet, ModifierId, Muscle } from '../types';

export const MODIFIER_INFO: Record<ModifierId, { name: string; effect: string; cost: string }> = {
  superset: {
    name: 'Superset',
    effect: 'Play two cards from opposite muscle groups back to back. The second hits the other enemy.',
    cost: 'Overrunning the rest after it hurts more.',
  },
  dropset: { name: 'Drop set', effect: '×1.5 damage.', cost: 'Counts as 2 sets of fatigue.' },
  paused: { name: 'Paused reps', effect: 'Ignores armor.', cost: '×0.8 damage.' },
  amrap: {
    name: 'AMRAP',
    effect: 'Damage grows with every rep past your plan. +3 reps is a crit.',
    cost: 'Take it to failure: it is the last set of this exercise.',
  },
};

export const MODIFIER_ORDER: ModifierId[] = ['superset', 'paused', 'dropset', 'amrap'];

export function unlockedModifiers(progress = 0): ModifierId[] {
  return MODIFIER_ORDER.filter((m) => progress >= config.modifiers.unlocks[m]);
}

/** Safety whitelist (§8) + unlock state. The UI never offers anything this rejects. */
export function canUseModifier(ex: Pick<Exercise, 'allowedModifiers'>, mod: ModifierId, unlocked: ModifierId[]): boolean {
  return ex.allowedModifiers.includes(mod) && unlocked.includes(mod);
}

type Group = 'push' | 'pull' | 'front' | 'rear' | 'core';
const GROUP: Record<Muscle, Group> = {
  chest: 'push',
  shoulders: 'push',
  triceps: 'push',
  back: 'pull',
  biceps: 'pull',
  quads: 'front',
  hamstrings_glutes: 'rear',
  core: 'core',
};
const OPPOSITE: Record<Group, Group[]> = {
  push: ['pull', 'core'],
  pull: ['push', 'core'],
  front: ['rear', 'core'],
  rear: ['front', 'core'],
  core: ['push', 'pull', 'front', 'rear'],
};

/** Superset pairing: push ↔ pull, quads ↔ hamstrings, core pairs with anything. */
export function areOpposite(a: Pick<Exercise, 'primaryMuscles'>, b: Pick<Exercise, 'primaryMuscles'>): boolean {
  const ga = GROUP[a.primaryMuscles[0]];
  const gb = GROUP[b.primaryMuscles[0]];
  return OPPOSITE[ga].includes(gb);
}

/** Fatigue a set adds (drop sets count double). Session sets and damage are unaffected. */
export function fatigueWeight(set: Pick<LoggedSet, 'modifier'>): number {
  return set.modifier === 'dropset' ? config.modifiers.dropset.fatigue : 1;
}

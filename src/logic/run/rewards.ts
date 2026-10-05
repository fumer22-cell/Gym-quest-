import { config } from '../../config';
import { EXERCISES } from '../../data/exercises';
import type { EquipmentId } from '../../types';
import type { Meters } from '../fatigue';
import { isAvailable, type Rng } from '../hand';

/**
 * Run drops: exercises outside your core deck (variations and less common moves), weighted
 * toward muscles still below their target zone. They only last for this run.
 */
export function dropCandidates(opts: {
  deck: string[];
  runCards: string[];
  equipment: readonly EquipmentId[];
  meters: Meters;
  rng: Rng;
  n?: number;
}): string[] {
  const n = opts.n ?? config.rewards.cardChoices;
  const { min } = config.volume.targetZone;
  const pool = EXERCISES.filter(
    (e) => !opts.deck.includes(e.id) && !opts.runCards.includes(e.id) && isAvailable(e, opts.equipment),
  ).map((e) => {
    const m = opts.meters[e.primaryMuscles[0]];
    const weight = m.status === 'cap' ? 0.2 : m.sessionSets < min ? 3 : 1;
    return { id: e.id, weight };
  });
  const out: string[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let r = opts.rng() * total;
    const i = Math.max(0, pool.findIndex((p) => (r -= p.weight) < 0));
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  return out;
}

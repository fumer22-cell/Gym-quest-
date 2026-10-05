import { config } from '../../config';
import { getExercise } from '../../data/exercises';
import type { BossKind, BossLift, Enemy, EnemyKind, Intent, IntentType, Muscle, Nemesis, WeakPoint } from '../../types';
import { MUSCLES } from '../../types';
import type { Meters } from '../fatigue';
import { shuffle, type Rng } from '../hand';

export const ENEMY_FOR_MUSCLE: Record<Muscle, { kind: EnemyKind; name: string }> = {
  quads: { kind: 'golem', name: 'Stone Golem' },
  hamstrings_glutes: { kind: 'bramble', name: 'Bramble Beast' },
  chest: { kind: 'knight', name: 'Shield Knight' },
  back: { kind: 'wraith', name: 'Rope Wraith' },
  shoulders: { kind: 'harpy', name: 'Gale Harpy' },
  biceps: { kind: 'ogre', name: 'Iron Ogre' },
  triceps: { kind: 'ram', name: 'Ram Brute' },
  core: { kind: 'serpent', name: 'Coil Serpent' },
};

export const BOSS_FOR_LIFT: Record<BossLift, { kind: BossKind; name: string; recolor?: Record<string, string> }> = {
  bench: { kind: 'wyrm', name: 'Iron Wyrm' },
  ohp: { kind: 'wyrm', name: 'Storm Wyrm', recolor: { r: '#3b5dc9', o: '#41a6f6', p: '#29366f' } },
  squat: { kind: 'giant', name: 'Frost Giant' },
  deadlift: { kind: 'treant', name: 'Gravebound Treant' },
};

/** Muscles the boss is weak to: the primary muscles of its lift. */
export function bossWeakness(lift: BossLift): Muscle[] {
  return getExercise({ bench: 'bench_press', ohp: 'overhead_press', squat: 'back_squat', deadlift: 'deadlift' }[lift]).primaryMuscles;
}

function between(rng: Rng, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function rollIntent(rng: Rng, opts: { boss?: boolean; first?: boolean; training?: boolean } = {}): Intent {
  if (opts.training) return { type: 'idle', value: 0 };
  const w = config.combat.intentWeights;
  const pool: [IntentType, number][] = [
    ['attack', opts.first ? 0 : w.attack],
    ['armor', w.armor],
    ['disrupt', w.disrupt],
    ['regen', w.regen],
  ];
  const total = pool.reduce((s, [, n]) => s + n, 0);
  let r = rng() * total;
  let type: IntentType = 'armor';
  for (const [t, n] of pool) {
    if ((r -= n) < 0) {
      type = t;
      break;
    }
  }
  const range = opts.boss ? config.combat.bossAttackDamage : config.combat.attackDamage;
  const value =
    type === 'attack'
      ? between(rng, range.min, range.max)
      : type === 'regen'
        ? config.combat.enemyRegen
        : type === 'armor'
          ? Math.round(config.combat.armorReduction * 100)
          : 1;
  return { type, value };
}

function intents(rng: Rng, opts: { boss?: boolean; training?: boolean }): Intent[] {
  return [rollIntent(rng, { ...opts, first: true }), rollIntent(rng, opts), rollIntent(rng, opts)];
}

/**
 * Coverage-aware spawning (§9): enemies are weak to the muscles that most need work right now,
 * so any path through the map adds up to a full-body session. Capped muscles never spawn.
 */
export function spawnEnemies(
  meters: Meters,
  rng: Rng,
  opts: {
    idPrefix: string;
    fightsLeft: number;
    training?: boolean;
    /** Muscles the boss is weak to: leave this many sets of room for the boss fight. */
    reserve?: { muscles: Muscle[]; sets: number };
    /** Only spawn for muscles the lifter can train right now (equipment, lockout). */
    canTrain?: (m: Muscle) => boolean;
  },
): Enemy[] {
  const { min } = config.volume.targetZone;
  const cap = config.volume.fatigueCap;
  const roomFor = (m: Muscle) => cap - meters[m].fatigue - (opts.reserve?.muscles.includes(m) ? opts.reserve.sets : 0);
  const open = shuffle(MUSCLES, rng).filter(
    (m) => meters[m].status !== 'cap' && roomFor(m) >= 1 && (opts.canTrain?.(m) ?? true),
  );
  const needy = open
    .filter((m) => meters[m].sessionSets < min)
    .sort((a, b) => meters[a].sessionSets - meters[b].sessionSets);
  let picks: Muscle[];
  if (needy.length === 0) {
    // Everything is in its zone: a single light bonus fight on the freshest muscle.
    picks = open.sort((a, b) => meters[a].fatigue - meters[b].fatigue).slice(0, 1);
  } else {
    let count = Math.ceil(needy.length / Math.max(1, opts.fightsLeft));
    if (count === 1 && needy.length >= 2 && rng() < config.combat.twoEnemyChance) count = 2;
    picks = needy.slice(0, Math.min(3, Math.max(1, count)));
  }
  // Nothing left to train safely today: no enemies (the caller treats the node as clear).
  if (picks.length === 0) return [];

  return picks.map((m, i) => {
    const room = Math.floor(roomFor(m));
    const need = Math.ceil(min - meters[m].sessionSets);
    const sets = Math.max(1, Math.min(room, Math.max(config.combat.enemySets.min, Math.min(config.combat.enemySets.max, need))));
    const kind = opts.training ? { kind: 'dummy' as EnemyKind, name: `Training Dummy` } : ENEMY_FOR_MUSCLE[m];
    const hp = sets * config.combat.hpPerRequiredSet;
    return {
      id: `${opts.idPrefix}-${i}`,
      kind: kind.kind,
      name: kind.name,
      weakness: [m],
      hp,
      maxHp: hp,
      intents: intents(rng, { training: opts.training }),
    };
  });
}

export function createBoss(lift: BossLift, weakPoint: WeakPoint, rng: Rng, id = 'boss'): Enemy {
  const b = BOSS_FOR_LIFT[lift];
  const hp = config.boss.sets * config.combat.hpPerRequiredSet;
  return {
    id,
    kind: b.kind,
    name: b.name,
    weakness: bossWeakness(lift),
    hp,
    maxHp: hp,
    intents: intents(rng, { boss: true }),
    isBoss: true,
    weakPoint,
    armorBroken: false,
    setsTaken: 0,
  };
}

const NEMESIS_NAMES = ['Grimhide', 'Vorgath', 'Old Ironjaw', 'Skarn', 'Mordrel', 'Kesh the Patient', 'Hollowmaw', 'Brakka'];

export function nemesisName(kindName: string, rng: Rng): string {
  return `${NEMESIS_NAMES[Math.floor(rng() * NEMESIS_NAMES.length)]}, the ${kindName}`;
}

/** A returning nemesis keeps the weak point it escaped with. */
export function createNemesisEnemy(n: Nemesis, weakPoint: WeakPoint, rng: Rng): Enemy {
  const boss = createBoss(n.lift, weakPoint, rng, `nemesis-${n.id}`);
  return { ...boss, name: n.name, nemesisId: n.id };
}

export function enemyLabel(e: Enemy): string {
  return e.name;
}

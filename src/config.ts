/**
 * Every tunable number in Gym Quest lives here so balance can change without touching logic.
 * Values not yet used by the current milestone are included so the whole design is visible in one place.
 */
import type { BossLift, Unit } from './types';

export const config = {
  // ── Cards & deck ────────────────────────────────────────────────
  deck: {
    handSize: 4,
    /** Permanent deck cap; keeping a card past this means removing one. */
    maxSize: 12,
    minSize: 4,
    starter: ['back_squat', 'bench_press', 'barbell_row', 'romanian_deadlift', 'overhead_press', 'lat_pulldown'],
  },

  // ── Logging ─────────────────────────────────────────────────────
  logging: {
    /** Stepper increments in the user's display unit. */
    weightStep: { lb: 5, kg: 2.5 } satisfies Record<Unit, number>,
    repStep: 1,
    defaultReps: 8,
    /** Prefill for an exercise never logged before, in each display unit, keyed by its "main" equipment. */
    defaultStart: {
      lb: { barbell: 45, ez_bar: 25, dumbbells: 20, kettlebell: 25, cable: 30, machine: 50, bodyweight: 0 },
      kg: { barbell: 20, ez_bar: 10, dumbbells: 8, kettlebell: 12, cable: 15, machine: 20, bodyweight: 0 },
    } satisfies Record<Unit, Record<string, number>>,
  },

  // ── Volume & fatigue (§5) ───────────────────────────────────────
  volume: {
    primaryCredit: 1.0,
    secondaryCredit: 0.5,
    /** Hard sets per muscle per session that count as "in the zone". */
    targetZone: { min: 4, max: 8 },
    /** Sets-equivalent of fatigue at which a muscle locks out. */
    fatigueCap: 8,
    /** Carryover fatigue decays linearly to 0 over this many hours. */
    carryoverHours: 72,
    /**
     * Lockout: a card locks when any of its primary muscles reaches the cap.
     * Set true to also lock compounds when a secondary muscle is capped.
     */
    compoundLocksOnSecondary: false,
  },

  // ── Rest (§7) ───────────────────────────────────────────────────
  rest: {
    /** Seconds. Ready at min, the window closes at max, enemies attack after max + grace. */
    compound: { min: 180, max: 300 },
    isolation: { min: 90, max: 150 },
    grace: 60,
  },

  // ── Damage (§6) ─────────────────────────────────────────────────
  damage: {
    base: 100,
    clampMin: 25,
    clampMax: 250,
    /** Baseline = median set volume over this many recent sessions of the exercise. */
    baselineSessions: 3,
    critMultiplier: 2,
    secondaryMatchMultiplier: 0.5,
    /** Damage when there is no history yet to compare against (first time doing an exercise). */
    calibrationDamage: 100,
  },

  // ── Combat (§7) ─────────────────────────────────────────────────
  combat: {
    playerMaxHp: 100,
    hpPerRequiredSet: 100,
    /** Armor intent: unmodified cards deal this much less for a turn. */
    armorReduction: 0.5,
    startingModifierCharges: 2,
    /** Sets each regular enemy needs (HP = sets × hpPerRequiredSet). */
    enemySets: { min: 2, max: 4 },
    /** Chance a fight has two enemies (good for supersets) when 2+ muscles still need work. */
    twoEnemyChance: 0.5,
    /** Damage an Attack intent deals if the rest window + grace is overrun. */
    attackDamage: { min: 8, max: 14 },
    bossAttackDamage: { min: 12, max: 20 },
    /** Regen intent: enemy heals this much when the next set lands. */
    enemyRegen: 25,
    /** Relative chance of each intent. The first intent of a fight is never an attack. */
    intentWeights: { attack: 5, armor: 2, disrupt: 2, regen: 1 },
    /** At 0 HP the fight ends with reduced rewards; you get back up with this much HP. */
    knockoutRecoverHp: 40,
  },

  // ── Rest cards & recovery (§7) ─────────────────────────────────
  restCards: {
    offered: 3,
    shield: 8,
    heal: 8,
    regenPerSet: 3,
    regenSets: 3,
    counter: 20,
    readIntentTurns: 2,
    /** "Real action" variants: bigger effects, honor system. */
    waterHeal: 16,
    breathingShield: 12,
    breathingHeal: 6,
    breathingSeconds: 30,
  },
  /** Warm-ups heal and shield a little (first few per fight). */
  warmup: { heal: 3, shield: 4, perFight: 3 },
  campfire: { healPct: 0.4, suggestedMinutes: 4 },

  // ── Rewards & progression (§12) ────────────────────────────────
  rewards: {
    cardChoices: 3,
    chargeChance: 0.5,
    treasureCardChoices: 3,
  },
  modifiers: {
    dropset: { damage: 1.5, fatigue: 2 },
    paused: { damage: 0.8 },
    /** AMRAP: +10% damage per rep beyond your planned reps; crit at +3 reps. */
    amrap: { perExtraRep: 0.1, critExtraReps: 3 },
    superset: { overrunMultiplier: 1.5 },
    /** Unlock progress needed for each modifier (+1 per cleared run, +2 per nemesis slain). */
    unlocks: { superset: 0, paused: 0, dropset: 2, amrap: 4 },
  },
  mastery: {
    /** One level per +5% of your first estimated 1RM (or +2 reps for bodyweight). */
    stepPct: 0.05,
    bodyweightRepStep: 2,
    bonusPerLevel: 0.02,
    maxBonus: 0.2,
    tiers: [
      { level: 0, name: 'Plain' },
      { level: 1, name: 'Bronze' },
      { level: 3, name: 'Silver' },
      { level: 6, name: 'Gold' },
      { level: 10, name: 'Mythic' },
    ],
  },

  // ── Bosses & readiness (§10) ───────────────────────────────────
  boss: {
    /** Boss HP in sets (×hpPerRequiredSet). */
    sets: 5,
    /** If the armor is still intact after this many sets on the boss, it escapes. */
    escapeAfterSets: 8,
    accessoryArmorMultiplier: 0.25,
    armorBreakMultiplier: 3,
    /** Weak-point threshold as a fraction of predicted 1RM (a ~3–5 rep target). */
    thresholdPct: 0.88,
    calibrationPct: 0.8,
    targetReps: 5,
    /** The weak point breaks on any set at least as strong as target weight × minReps (by estimated 1RM). */
    minReps: 3,
    /** Never more than this above the last real performance on the compound. */
    safetyCap: { bench: 0.1, ohp: 0.1, squat: 0.05, deadlift: 0.05 } satisfies Record<BossLift, number>,
    ratioLearningExponent: 0.3,
    /** Round thresholds to a loadable weight, in display units. */
    loadableIncrement: { lb: 5, kg: 2.5 } satisfies Record<Unit, number>,
    /** Readiness uses each accessory's best set from its last N sessions. */
    recentSessions: 3,
    /** A set "meets" the weak point within this tolerance of the target's estimated 1RM. */
    tolerance: 0.005,
  },

  /**
   * Default accessory → compound 1RM ratios (accessory1RM × ratio ≈ compound 1RM),
   * plus how much each estimate counts in the blend (more similar = higher weight).
   * Dumbbell/kettlebell ratios apply to the pair total (2 × logged per-hand weight).
   */
  parentRatios: {
    incline_bench_press: { lift: 'bench', ratio: 1 / 0.8, weight: 0.8 },
    close_grip_bench_press: { lift: 'bench', ratio: 1.1, weight: 0.9 },
    dumbbell_bench_press: { lift: 'bench', ratio: 1.05, weight: 0.7 },
    incline_dumbbell_press: { lift: 'bench', ratio: 1.05 / 0.8, weight: 0.5 },
    machine_chest_press: { lift: 'bench', ratio: 1.0, weight: 0.4 },
    front_squat: { lift: 'squat', ratio: 1.25, weight: 0.9 },
    leg_press: { lift: 'squat', ratio: 0.45, weight: 0.3 },
    bulgarian_split_squat: { lift: 'squat', ratio: 1.3, weight: 0.4 },
    goblet_squat: { lift: 'squat', ratio: 2.5, weight: 0.2 },
    romanian_deadlift: { lift: 'deadlift', ratio: 1.3, weight: 0.8 },
    hip_thrust: { lift: 'deadlift', ratio: 0.75, weight: 0.4 },
    dumbbell_shoulder_press: { lift: 'ohp', ratio: 1.0, weight: 0.7 },
    machine_shoulder_press: { lift: 'ohp', ratio: 0.9, weight: 0.4 },
  } satisfies Record<string, { lift: BossLift; ratio: number; weight: number }>,

  // ── Run structure (§9) ─────────────────────────────────────────
  run: {
    /** Nodes on any path, boss included. */
    nodes: { min: 5, max: 7 },
    /** Nodes per layer (branching). */
    paths: { min: 2, max: 3 },
    /** Training Grounds: a short straight path of easy fights. */
    trainingFights: 3,
  },

  /** Rounds stored kg values back to a clean display number. */
  displayDecimals: 1,
  kgPerLb: 0.45359237,
} as const;

export type Config = typeof config;

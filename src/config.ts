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
    armorReduction: 0.5,
    startingModifierCharges: 2,
  },

  // ── Bosses & readiness (§10) ───────────────────────────────────
  boss: {
    accessoryArmorMultiplier: 0.25,
    armorBreakMultiplier: 3,
    /** Weak-point threshold as a fraction of predicted 1RM (a ~3–5 rep target). */
    thresholdPct: 0.88,
    calibrationPct: 0.8,
    targetReps: 5,
    /** Never more than this above the last real performance on the compound. */
    safetyCap: { bench: 0.1, ohp: 0.1, squat: 0.05, deadlift: 0.05 } satisfies Record<BossLift, number>,
    ratioLearningExponent: 0.3,
    /** Round thresholds to a loadable weight, in display units. */
    loadableIncrement: { lb: 5, kg: 2.5 } satisfies Record<Unit, number>,
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
    nodes: { min: 5, max: 7 },
    paths: { min: 2, max: 3 },
  },

  /** Rounds stored kg values back to a clean display number. */
  displayDecimals: 1,
  kgPerLb: 0.45359237,
} as const;

export type Config = typeof config;

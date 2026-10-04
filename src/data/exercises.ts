import { config } from '../config';
import type { BossLift, Exercise, ModifierId } from '../types';

/**
 * Safety whitelists (§8). AMRAP, drop sets and rest-pause are never allowed on heavy free-weight
 * barbell lifts; failure-style modifiers are meant for machines, cables, dumbbell isolations
 * and bodyweight moves.
 */
const HEAVY_FREE_WEIGHT: ModifierId[] = ['superset', 'paused'];
const SAFE_TO_FAILURE: ModifierId[] = ['superset', 'dropset', 'paused', 'amrap'];

type Seed = Omit<Exercise, 'parentCompound'>;

function withParent(e: Seed): Exercise {
  const p = (config.parentRatios as Record<string, { lift: BossLift; ratio: number }>)[e.id];
  return p ? { ...e, parentCompound: { lift: p.lift, ratio: p.ratio } } : e;
}

const SEED: Seed[] = [
  // ── Chest ──
  {
    id: 'bench_press', name: 'Bench Press',
    primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'],
    isCompound: true, isBodyweight: false, equipment: ['barbell', 'bench'],
    allowedModifiers: HEAVY_FREE_WEIGHT, bossLift: 'bench',
  },
  {
    id: 'incline_bench_press', name: 'Incline Bench Press',
    primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'],
    isCompound: true, isBodyweight: false, equipment: ['barbell', 'bench'],
    allowedModifiers: HEAVY_FREE_WEIGHT,
  },
  {
    id: 'dumbbell_bench_press', name: 'Dumbbell Bench Press',
    primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'],
    isCompound: true, isBodyweight: false, equipment: ['dumbbells', 'bench'],
    allowedModifiers: HEAVY_FREE_WEIGHT, perHand: true,
  },
  {
    id: 'incline_dumbbell_press', name: 'Incline Dumbbell Press',
    primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'],
    isCompound: true, isBodyweight: false, equipment: ['dumbbells', 'bench'],
    allowedModifiers: HEAVY_FREE_WEIGHT, perHand: true,
  },
  {
    id: 'machine_chest_press', name: 'Machine Chest Press',
    primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'],
    isCompound: true, isBodyweight: false, equipment: ['chest_press_machine'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'cable_fly', name: 'Cable Fly',
    primaryMuscles: ['chest'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['cable'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'push_up', name: 'Push-up',
    primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders', 'core'],
    isCompound: true, isBodyweight: true, equipment: [],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'dip', name: 'Dip',
    primaryMuscles: ['chest', 'triceps'], secondaryMuscles: ['shoulders'],
    isCompound: true, isBodyweight: true, equipment: ['dip_station'],
    allowedModifiers: SAFE_TO_FAILURE,
  },

  // ── Back ──
  {
    id: 'barbell_row', name: 'Barbell Row',
    primaryMuscles: ['back'], secondaryMuscles: ['biceps', 'hamstrings_glutes'],
    isCompound: true, isBodyweight: false, equipment: ['barbell'],
    allowedModifiers: HEAVY_FREE_WEIGHT,
  },
  {
    id: 'lat_pulldown', name: 'Lat Pulldown',
    primaryMuscles: ['back'], secondaryMuscles: ['biceps'],
    isCompound: true, isBodyweight: false, equipment: ['lat_pulldown'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'pull_up', name: 'Pull-up',
    primaryMuscles: ['back'], secondaryMuscles: ['biceps', 'core'],
    isCompound: true, isBodyweight: true, equipment: ['pullup_bar'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'seated_cable_row', name: 'Seated Cable Row',
    primaryMuscles: ['back'], secondaryMuscles: ['biceps'],
    isCompound: true, isBodyweight: false, equipment: ['cable'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'one_arm_dumbbell_row', name: 'One-arm Dumbbell Row',
    primaryMuscles: ['back'], secondaryMuscles: ['biceps'],
    isCompound: true, isBodyweight: false, equipment: ['dumbbells', 'bench'],
    allowedModifiers: SAFE_TO_FAILURE, perHand: true,
  },

  // ── Shoulders ──
  {
    id: 'overhead_press', name: 'Overhead Press',
    primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps', 'core'],
    isCompound: true, isBodyweight: false, equipment: ['barbell'],
    allowedModifiers: HEAVY_FREE_WEIGHT, bossLift: 'ohp',
  },
  {
    id: 'dumbbell_shoulder_press', name: 'Dumbbell Shoulder Press',
    primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps'],
    isCompound: true, isBodyweight: false, equipment: ['dumbbells', 'bench'],
    allowedModifiers: HEAVY_FREE_WEIGHT, perHand: true,
  },
  {
    id: 'machine_shoulder_press', name: 'Machine Shoulder Press',
    primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps'],
    isCompound: true, isBodyweight: false, equipment: ['shoulder_press_machine'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'lateral_raise', name: 'Lateral Raise',
    primaryMuscles: ['shoulders'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['dumbbells'],
    allowedModifiers: SAFE_TO_FAILURE, perHand: true,
  },
  {
    id: 'face_pull', name: 'Face Pull',
    primaryMuscles: ['shoulders'], secondaryMuscles: ['back'],
    isCompound: false, isBodyweight: false, equipment: ['cable'],
    allowedModifiers: SAFE_TO_FAILURE,
  },

  // ── Biceps ──
  {
    id: 'barbell_curl', name: 'Barbell Curl',
    primaryMuscles: ['biceps'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['barbell'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'dumbbell_curl', name: 'Dumbbell Curl',
    primaryMuscles: ['biceps'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['dumbbells'],
    allowedModifiers: SAFE_TO_FAILURE, perHand: true,
  },
  {
    id: 'hammer_curl', name: 'Hammer Curl',
    primaryMuscles: ['biceps'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['dumbbells'],
    allowedModifiers: SAFE_TO_FAILURE, perHand: true,
  },
  {
    id: 'cable_curl', name: 'Cable Curl',
    primaryMuscles: ['biceps'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['cable'],
    allowedModifiers: SAFE_TO_FAILURE,
  },

  // ── Triceps ──
  {
    id: 'triceps_pushdown', name: 'Triceps Pushdown',
    primaryMuscles: ['triceps'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['cable'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'overhead_cable_extension', name: 'Overhead Cable Extension',
    primaryMuscles: ['triceps'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['cable'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'skull_crusher', name: 'Skull Crusher',
    primaryMuscles: ['triceps'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['ez_bar', 'bench'],
    // Lowered toward the head: no training to failure.
    allowedModifiers: HEAVY_FREE_WEIGHT,
  },
  {
    id: 'close_grip_bench_press', name: 'Close-grip Bench Press',
    primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'shoulders'],
    isCompound: true, isBodyweight: false, equipment: ['barbell', 'bench'],
    allowedModifiers: HEAVY_FREE_WEIGHT,
  },

  // ── Quads ──
  {
    id: 'back_squat', name: 'Back Squat',
    primaryMuscles: ['quads'], secondaryMuscles: ['hamstrings_glutes', 'core'],
    isCompound: true, isBodyweight: false, equipment: ['barbell', 'squat_rack'],
    allowedModifiers: HEAVY_FREE_WEIGHT, bossLift: 'squat',
  },
  {
    id: 'front_squat', name: 'Front Squat',
    primaryMuscles: ['quads'], secondaryMuscles: ['core', 'hamstrings_glutes'],
    isCompound: true, isBodyweight: false, equipment: ['barbell', 'squat_rack'],
    allowedModifiers: HEAVY_FREE_WEIGHT,
  },
  {
    id: 'leg_press', name: 'Leg Press',
    primaryMuscles: ['quads'], secondaryMuscles: ['hamstrings_glutes'],
    isCompound: true, isBodyweight: false, equipment: ['leg_press'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'leg_extension', name: 'Leg Extension',
    primaryMuscles: ['quads'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['leg_extension'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat',
    primaryMuscles: ['quads'], secondaryMuscles: ['hamstrings_glutes'],
    isCompound: true, isBodyweight: false, equipment: ['dumbbells', 'bench'],
    allowedModifiers: HEAVY_FREE_WEIGHT, perHand: true,
  },
  {
    id: 'goblet_squat', name: 'Goblet Squat',
    primaryMuscles: ['quads'], secondaryMuscles: ['hamstrings_glutes', 'core'],
    isCompound: true, isBodyweight: false, equipment: ['dumbbells'],
    allowedModifiers: SAFE_TO_FAILURE,
  },

  // ── Hamstrings / glutes ──
  {
    id: 'deadlift', name: 'Deadlift',
    primaryMuscles: ['hamstrings_glutes', 'back'], secondaryMuscles: ['quads', 'core'],
    isCompound: true, isBodyweight: false, equipment: ['barbell'],
    allowedModifiers: HEAVY_FREE_WEIGHT, bossLift: 'deadlift',
  },
  {
    id: 'romanian_deadlift', name: 'Romanian Deadlift',
    primaryMuscles: ['hamstrings_glutes'], secondaryMuscles: ['back'],
    isCompound: true, isBodyweight: false, equipment: ['barbell'],
    allowedModifiers: HEAVY_FREE_WEIGHT,
  },
  {
    id: 'leg_curl', name: 'Leg Curl',
    primaryMuscles: ['hamstrings_glutes'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['leg_curl'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'hip_thrust', name: 'Hip Thrust',
    primaryMuscles: ['hamstrings_glutes'], secondaryMuscles: ['quads'],
    isCompound: true, isBodyweight: false, equipment: ['barbell', 'bench'],
    allowedModifiers: HEAVY_FREE_WEIGHT,
  },
  {
    id: 'kettlebell_swing', name: 'Kettlebell Swing',
    primaryMuscles: ['hamstrings_glutes'], secondaryMuscles: ['core', 'back'],
    isCompound: true, isBodyweight: false, equipment: ['kettlebell'],
    // Ballistic: form breaks down under fatigue.
    allowedModifiers: HEAVY_FREE_WEIGHT,
  },

  // ── Core ──
  {
    id: 'hanging_leg_raise', name: 'Hanging Leg Raise',
    primaryMuscles: ['core'], secondaryMuscles: [],
    isCompound: false, isBodyweight: true, equipment: ['pullup_bar'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'cable_crunch', name: 'Cable Crunch',
    primaryMuscles: ['core'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['cable'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'ab_wheel_rollout', name: 'Ab Wheel Rollout',
    primaryMuscles: ['core'], secondaryMuscles: ['shoulders'],
    isCompound: false, isBodyweight: true, equipment: ['ab_wheel'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'dead_bug', name: 'Dead Bug',
    primaryMuscles: ['core'], secondaryMuscles: [],
    isCompound: false, isBodyweight: true, equipment: [],
    allowedModifiers: SAFE_TO_FAILURE,
  },
  {
    id: 'pallof_press', name: 'Pallof Press',
    primaryMuscles: ['core'], secondaryMuscles: [],
    isCompound: false, isBodyweight: false, equipment: ['cable'],
    allowedModifiers: SAFE_TO_FAILURE,
  },
];

export const EXERCISES: Exercise[] = SEED.map(withParent);

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
}

export function findExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

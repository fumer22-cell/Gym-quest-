export const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings_glutes',
  'core',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export type ModifierId = 'superset' | 'dropset' | 'paused' | 'amrap';
export type BossLift = 'bench' | 'squat' | 'deadlift' | 'ohp';

export type EquipmentId =
  | 'barbell'
  | 'squat_rack'
  | 'bench'
  | 'dumbbells'
  | 'ez_bar'
  | 'cable'
  | 'lat_pulldown'
  | 'leg_press'
  | 'leg_curl'
  | 'leg_extension'
  | 'chest_press_machine'
  | 'shoulder_press_machine'
  | 'pullup_bar'
  | 'dip_station'
  | 'kettlebell'
  | 'ab_wheel';

export interface Exercise {
  id: string;
  name: string;
  /** Count 1.0 set each. */
  primaryMuscles: Muscle[];
  /** Count 0.5 set each (see config.volume.secondaryCredit). */
  secondaryMuscles: Muscle[];
  isCompound: boolean;
  isBodyweight: boolean;
  /** All listed equipment is required. Empty = no equipment. */
  equipment: EquipmentId[];
  /** Safety whitelist: only these modifiers may ever be offered for this exercise. */
  allowedModifiers: ModifierId[];
  bossLift?: BossLift;
  /** Default ratio comes from config.parentRatios; learned ratios are stored per user later. */
  parentCompound?: { lift: BossLift; ratio: number };
  /** Logged weight is per dumbbell/kettlebell (one hand), not the total. */
  perHand?: boolean;
}

export type Unit = 'lb' | 'kg';

export interface Settings {
  key: 'main';
  unit: Unit;
  equipment: EquipmentId[];
  /** Permanent core deck (exercise ids). */
  deck: string[];
  sound: boolean;
  haptics: boolean;
}

export interface Session {
  id?: number;
  startedAt: number;
  endedAt?: number;
  /** Cards currently in hand (exercise ids). */
  hand: string[];
  drawPile: string[];
  discard: string[];
  /** Cards swapped away this session ("machine taken") — never offered again this session. */
  swappedOut: string[];
  activeExerciseId?: string;
  restStartedAt?: number;
  restExerciseId?: string;
}

export interface LoggedSet {
  id?: number;
  sessionId: number;
  exerciseId: string;
  /** Always stored in kg (0 for bodyweight). Display unit conversion happens in the UI. */
  weightKg: number;
  reps: number;
  isWarmup: boolean;
  loggedAt: number;
}

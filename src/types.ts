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
  /** Onboarding (favorites + equipment) finished. */
  onboarded?: boolean;
  /** Training Grounds calibration run finished. */
  calibrated?: boolean;
  /** Learned accessory → compound ratios (exercise id → ratio), §10 step 6. */
  ratios?: Record<string, number>;
  nemeses?: Nemesis[];
  /** Progress toward modifier unlocks. */
  modifierProgress?: number;
  runsCleared?: number;
  /** Boss lift of the last run, so bosses rotate. */
  lastBossLift?: BossLift;
}

export interface Nemesis {
  id: string;
  name: string;
  kind: BossKind;
  lift: BossLift;
  targetWeightKg: number;
  targetReps: number;
  escapedAt: number;
  defeatedAt?: number;
  attempts: number;
}

export type BossKind = 'giant' | 'wyrm' | 'treant';
export type EnemyKind =
  | 'golem' | 'bramble' | 'knight' | 'wraith' | 'harpy' | 'ogre' | 'ram' | 'serpent' | 'dummy'
  | BossKind;

export type IntentType = 'attack' | 'disrupt' | 'armor' | 'regen' | 'idle';
export interface Intent {
  type: IntentType;
  value: number;
}

export interface WeakPoint {
  lift: BossLift;
  exerciseId: string;
  targetWeightKg: number;
  targetReps: number;
  /** Estimated 1RM a set must reach to break the armor. */
  thresholdE1rm: number;
  predictedE1rm: number | null;
  /** No compound history yet: a conservative calibration fight. */
  calibration: boolean;
  /** Accessories (and their ratios) that fed the prediction, for ratio learning. */
  sources: { exerciseId: string; e1rm: number; ratio: number }[];
}

export interface Enemy {
  id: string;
  kind: EnemyKind;
  name: string;
  /** Muscles this enemy is weak to (cards must hit one of them). */
  weakness: Muscle[];
  hp: number;
  maxHp: number;
  intents: Intent[];
  isBoss?: boolean;
  nemesisId?: string;
  weakPoint?: WeakPoint;
  armorBroken?: boolean;
  /** Sets thrown at this boss so far (for escape). */
  setsTaken?: number;
}

export type NodeType = 'fight' | 'campfire' | 'treasure' | 'nemesis' | 'boss';
export interface MapNode {
  id: string;
  layer: number;
  col: number;
  type: NodeType;
  next: string[];
}

export interface FightState {
  nodeId: string;
  enemies: Enemy[];
  turn: number;
  /** Enemy targeted by the next set. */
  targetId?: string;
  /** Card locked by a Disrupt for the next set. */
  disrupted?: string;
  /** Read Intent: show the next N intents until this turn. */
  revealUntilTurn?: number;
  /** Rest period (restStartedAt) whose overrun attack already landed. */
  attackResolvedFor?: number;
  /** Rest cards offered this rest period and the rest period one was played in. */
  restOffer: RestCardId[];
  restCardPlayedFor?: number;
  counterFor?: number;
  /** Superset in progress: first card done, the next opposite-group card completes it. */
  superset?: { firstExerciseId: string; firstTargetId?: string };
  supersetRestFor?: number;
  knockedOut?: boolean;
  /** Warm-up sets that already healed/shielded this fight (capped). */
  warmups?: number;
  /** Latest event, for animation. */
  lastEvent?: CombatEvent;
}

export interface CombatEvent {
  at: number;
  kind: 'hit' | 'hurt' | 'heal' | 'shield' | 'defeat' | 'armor-break' | 'escape' | 'regen' | 'knockout' | 'counter' | 'info';
  enemyId?: string;
  amount?: number;
  crit?: boolean;
  text: string;
}

export type RestCardId = 'shield' | 'heal' | 'regen' | 'counter' | 'read' | 'water' | 'breathing';

export interface RewardOffer {
  cards: string[];
  charge: boolean;
  /** Treasure lets you take a charge instead of a card. */
  treasure?: boolean;
  nemesisSlain?: boolean;
}

export interface RunState {
  mode: 'run' | 'training';
  map: MapNode[];
  /** Current node; null = standing at the entrance, choosing the first node. */
  nodeId: string | null;
  visited: string[];
  phase: 'map' | 'node' | 'reward' | 'end';
  hp: number;
  maxHp: number;
  block: number;
  regenSets: number;
  charges: number;
  /** Exercise cards dropped this run (temporary). */
  runCards: string[];
  fight?: FightState;
  reward?: RewardOffer;
  bossLift?: BossLift;
  bossOutcome?: 'defeated' | 'escaped' | 'broken';
  nemesisId?: string;
  nemesisOutcome?: 'defeated' | 'escaped';
  keptCard?: string;
  /** Every muscle reached its zone and the boss was resolved. */
  cleared?: boolean;
  log: string[];
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
  run?: RunState;
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
  /** Filled in when the set is logged (warm-ups deal 0). */
  damage?: number;
  isPR?: boolean;
  /** Epley estimated 1RM in kg; null for bodyweight exercises. */
  e1rm?: number | null;
  modifier?: ModifierId;
  targetEnemyId?: string;
}

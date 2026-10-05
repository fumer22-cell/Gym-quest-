import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { config } from '../../config';
import { getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';
import { setTarget } from '../../db/quest';
import { allHistoryFor, deleteSet, finishExercise, getPrefill, logSet, setActiveExercise } from '../../db/repo';
import { lockedBy, type Meters } from '../../logic/fatigue';
import { canUseModifier, MODIFIER_INFO, unlockedModifiers } from '../../logic/modifiers';
import { pickTarget, setDamage } from '../../logic/run/combat';
import { evaluateSet } from '../../logic/strength';
import { fromKg, toKg } from '../../logic/units';
import type { LoggedSet, ModifierId, Session, Settings } from '../../types';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { CROWN, LOCK } from '../art/sprites';
import { buzz } from '../feedback';
import { useConfirm } from '../hooks';
import { Screen, TopBar } from '../layout/Screen';
import { Stage } from '../scene/Stage';
import { RunClock } from '../screens/run/RunChrome';
import { sfx } from '../sound';
import { Hud } from './Combat';
import { MuscleChips, muscleStyle } from './ExerciseCard';
import { ModifierPicker } from './ModifierPicker';
import { RestCards, RestPill } from './RestPanel';
import { Stepper } from './Stepper';

function describeSet(s: LoggedSet, unit: Settings['unit'], bodyweight: boolean) {
  return bodyweight ? `${s.reps}` : `${fromKg(s.weightKg, unit)}×${s.reps}`;
}

/** Logging a set inside a fight: the "combat stance". Fits one phone screen. */
export function Logger({
  session,
  sessionSets,
  meters,
  exerciseId,
  settings,
  mastery = 0,
}: {
  session: Session;
  sessionSets: LoggedSet[];
  meters: Meters | undefined;
  exerciseId: string;
  settings: Settings;
  mastery?: number;
}) {
  const ex = getExercise(exerciseId);
  const unit = settings.unit;
  const run = session.run;
  const fight = run?.phase === 'node' ? run.fight : undefined;
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number>(config.logging.defaultReps);
  const [plannedReps, setPlannedReps] = useState<number>(config.logging.defaultReps);
  const [warmup, setWarmup] = useState(false);
  const [modifier, setModifier] = useState<ModifierId | undefined>();
  const [busy, setBusy] = useState(false);
  const [undoArmed, confirmUndo] = useConfirm();

  useEffect(() => {
    let cancelled = false;
    getPrefill(exerciseId, unit).then((p) => {
      if (cancelled) return;
      setWeight(fromKg(p.weightKg, unit));
      setReps(p.reps);
      setPlannedReps(p.reps);
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId, unit]);

  const history = useLiveQuery(() => allHistoryFor(exerciseId), [exerciseId]);
  const lastTime = (() => {
    const prior = (history ?? []).filter((s) => s.sessionId !== session.id && !s.isWarmup);
    if (prior.length === 0) return [];
    const latest = prior.reduce((a, b) => (b.loggedAt > a.loggedAt ? b : a));
    return prior.filter((s) => s.sessionId === latest.sessionId).sort((a, b) => a.loggedAt - b.loggedAt);
  })();

  const lock = meters ? lockedBy(ex, meters) : null;
  const mine = sessionSets.filter((s) => s.exerciseId === exerciseId);
  const workingCount = mine.filter((s) => !s.isWarmup).length;
  const progress = settings.modifierProgress ?? 0;
  const unlocked = unlockedModifiers(progress);
  const modsAvailable = !!fight && run?.mode === 'run';
  const usable = modsAvailable && modifier && canUseModifier(ex, modifier, unlocked) && run!.charges > 0 ? modifier : undefined;
  const supersetSecond = !!fight?.superset && fight.superset.firstExerciseId !== exerciseId;
  const target = fight ? pickTarget(exerciseId, fight, supersetSecond ? fight.superset?.firstTargetId : undefined) : undefined;
  const weightKg = weight === null || ex.isBodyweight ? 0 : toKg(weight, unit);

  const evaluation = history && weight !== null ? evaluateSet(ex, { weightKg, reps, isWarmup: warmup }, history, session.id) : null;
  const forecast =
    evaluation && target && !warmup
      ? setDamage(
          {
            exerciseId,
            weightKg,
            reps,
            isWarmup: false,
            modifier: usable,
            baseline: evaluation.baseline,
            isPR: evaluation.isPR,
            plannedReps,
            masteryLevel: mastery,
            junk: !!lock,
            now: Date.now(),
          },
          target,
        )
      : null;
  const wp = target?.isBoss && !target.armorBroken && target.weakPoint?.exerciseId === exerciseId ? target.weakPoint : undefined;

  const log = async () => {
    if (busy || weight === null) return;
    setBusy(true);
    try {
      const saved = await logSet(
        { sessionId: session.id!, exerciseId, weightKg, reps, isWarmup: warmup, modifier: warmup ? undefined : usable },
        Date.now(),
        { plannedReps },
      );
      buzz(settings, saved.isWarmup ? 30 : saved.isPR ? [60, 40, 60, 40, 160] : 50);
      if (saved.isWarmup) sfx(settings, 'heal');
      if (usable === 'superset' && !saved.isWarmup) await setActiveExercise(session.id!, undefined);
      setModifier(undefined);
    } finally {
      setBusy(false);
    }
  };

  const last = mine[mine.length - 1];
  const main = ex.primaryMuscles[0];
  let info: React.ReactNode;
  if (lock) {
    info = (
      <span className="lg-warn">
        <Pixel sprite={LOCK} size={18} /> {MUSCLE_INFO[lock].short} is capped: junk volume, no damage.
      </span>
    );
  } else if (usable) {
    info = (
      <span>
        <b>{MODIFIER_INFO[usable].name}:</b> {MODIFIER_INFO[usable].effect} <span className="muted">{MODIFIER_INFO[usable].cost}</span>
      </span>
    );
  } else if (wp) {
    info = (
      <span className="lg-weak">
        Weak point {fromKg(wp.targetWeightKg, unit)}×{config.boss.minReps}+ shatters the armor
      </span>
    );
  } else if (warmup) {
    info = <span className="muted">Warm-up: no fatigue. Heals {config.warmup.heal}, shields {config.warmup.shield}.</span>;
  } else {
    info = (
      <span className="muted">
        {lastTime.length ? `Last: ${lastTime.map((s) => describeSet(s, unit, ex.isBodyweight)).join(' ')}` : 'First time: deals 100 while we learn you'}
      </span>
    );
  }

  return (
    <Screen scene={target?.isBoss ? 'boss' : run?.mode === 'training' ? 'calm' : 'dungeon'} className="logger-screen">
      <TopBar
        left={
          <button className="icon-btn" onClick={() => setActiveExercise(session.id!, undefined)} aria-label="Back to hand">
            ←
          </button>
        }
        center={run && <Hud run={run} event={fight?.lastEvent} />}
        right={<RunClock session={session} sets={sessionSets} />}
      />
      {fight ? (
        <Stage
          compact
          enemies={fight.enemies}
          event={fight.lastEvent}
          targetId={target?.id}
          reveal={(fight.revealUntilTurn ?? 0) > fight.turn}
          unit={unit}
          onSelect={(id) => setTarget(session.id!, id)}
          top={
            <>
              <RestPill session={session} settings={settings} />
              <RestCards session={session} settings={settings} />
            </>
          }
        />
      ) : (
        <div className="stage stage-compact" />
      )}

      <div className="lg-head">
        <div className={`lg-art ${ex.isCompound ? '' : 'iso'}`} style={muscleStyle(main)}>
          <MuscleIcon muscle={main} size={40} />
        </div>
        <div className="lg-title">
          <h2>
            {ex.name}
            {mastery > 0 && <span className="lg-lv"> Lv {mastery}</span>}
          </h2>
          <MuscleChips id={exerciseId} showSecondary />
        </div>
        <div className="lg-sets">
          <span>
            {workingCount} set{workingCount === 1 ? '' : 's'}
            {supersetSecond && <em> · superset</em>}
          </span>
          {last && (
            <button className={`link ${undoArmed ? 'danger' : ''}`} onClick={() => confirmUndo(() => deleteSet(last.id!))}>
              {undoArmed ? 'Tap: undo' : 'Undo'}
            </button>
          )}
        </div>
      </div>

      <div className="lg-info">
        {info}
        {evaluation?.e1rm != null && <span className="lg-e1rm">1RM {fromKg(evaluation.e1rm, unit)}</span>}
        {evaluation?.isPR && !warmup && (
          <span className="pr-badge">
            <Pixel sprite={CROWN} size={16} /> PR
          </span>
        )}
      </div>

      {modsAvailable && !warmup && (
        <ModifierPicker ex={ex} unlocked={unlocked} progress={progress} charges={run!.charges} value={modifier} onChange={setModifier} />
      )}

      <div className="lg-steppers">
        {!ex.isBodyweight && weight !== null && (
          <Stepper label={ex.perHand ? `${unit} / hand` : unit} value={weight} step={config.logging.weightStep[unit]} onChange={setWeight} />
        )}
        <Stepper label="reps" value={reps} step={config.logging.repStep} min={1} decimals={0} onChange={setReps} />
      </div>

      <div className="lg-actions">
        <button className={`warmup-toggle ${warmup ? 'on' : ''}`} onClick={() => setWarmup((w) => !w)} aria-pressed={warmup}>
          Warm
          <br />
          up
        </button>
        <button className="btn btn-primary btn-strike" onClick={log} disabled={busy || weight === null}>
          <span>{warmup ? 'Log warm-up' : 'Strike!'}</span>
          {!warmup && fight && (
            <small>
              {forecast ? (forecast.armorBreak ? `SHATTER ${forecast.damage}` : `${forecast.damage} dmg`) : target ? '0 dmg' : 'no target'}
            </small>
          )}
        </button>
      </div>
      <button className="lg-finish link" onClick={() => finishExercise(session.id!, exerciseId)} disabled={workingCount === 0 && !lock}>
        {lock ? 'Discard this card' : 'Finish exercise · draw a new card'}
      </button>
    </Screen>
  );
}

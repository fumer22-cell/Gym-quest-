import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { config } from '../../config';
import { getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';
import { allHistoryFor, deleteSet, finishExercise, getPrefill, logSet, setActiveExercise } from '../../db/repo';
import { lockedBy, type Meters } from '../../logic/fatigue';
import { canUseModifier, unlockedModifiers } from '../../logic/modifiers';
import { compoundFor } from '../../logic/readiness';
import { pickTarget, setDamage } from '../../logic/run/combat';
import { evaluateSet } from '../../logic/strength';
import { fromKg, toKg } from '../../logic/units';
import type { LoggedSet, ModifierId, Session, Settings } from '../../types';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { CROWN, LOCK } from '../art/sprites';
import { buzz } from '../feedback';
import { useConfirm } from '../hooks';
import { sfx } from '../sound';
import { EnemyCard, Hud } from './Combat';
import { DamagePopup, type Hit } from './DamagePopup';
import { MuscleChips, muscleStyle } from './ExerciseCard';
import { MeterRow } from './Meters';
import { ModifierPicker } from './ModifierPicker';
import { RestPanel } from './RestPanel';
import { Stepper } from './Stepper';

function describeSet(s: LoggedSet, settings: Settings, bodyweight: boolean) {
  return bodyweight ? `${s.reps} reps` : `${fromKg(s.weightKg, settings.unit)} × ${s.reps}`;
}

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
  const [hit, setHit] = useState<Hit | null>(null);
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
  const usable = fight && run && run.mode === 'run' ? modifier && canUseModifier(ex, modifier, unlocked) && run.charges > 0 ? modifier : undefined : undefined;
  const supersetSecond = !!fight?.superset && fight.superset.firstExerciseId !== exerciseId;
  const target = fight ? pickTarget(exerciseId, fight, supersetSecond ? fight.superset?.firstTargetId : undefined) : undefined;
  const weightKg = weight === null ? 0 : ex.isBodyweight ? 0 : toKg(weight, unit);

  // Live forecast for the numbers on the steppers, against the enemy this set will hit.
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
      if (!saved.isWarmup) {
        setHit({ key: Date.now(), damage: saved.damage ?? 0, isPR: !!saved.isPR, junk: !!lock });
        buzz(settings, saved.isPR ? [60, 40, 60, 40, 160] : 50);
        if (!fight) sfx(settings, saved.isPR ? 'crit' : 'hit');
      } else {
        buzz(settings, 30);
        if (fight) sfx(settings, 'heal');
      }
      if (usable === 'superset' && !saved.isWarmup) await setActiveExercise(session.id!, undefined);
      setModifier(undefined);
    } finally {
      setBusy(false);
    }
  };

  const last = mine[mine.length - 1];
  const main = ex.primaryMuscles[0];

  return (
    <div className="logger">
      <div className="logger-top">
        <button className="btn btn-ghost" onClick={() => setActiveExercise(session.id!, undefined)}>
          ← Hand
        </button>
        <span className="logger-type">
          {ex.isCompound ? 'Compound' : 'Isolation'}
          {mastery > 0 && ` · Lv ${mastery}`}
        </span>
      </div>

      {run && fight && <Hud run={run} event={fight.lastEvent} />}
      {target && (
        <div className="logger-target">
          <EnemyCard enemy={target} unit={unit} selected={false} reveal={(fight!.revealUntilTurn ?? 0) > fight!.turn} event={fight!.lastEvent} compact />
          {supersetSecond && <span className="superset-tag">Superset: hits the other enemy</span>}
        </div>
      )}

      <div className="logger-head">
        <div
          key={`art-${hit?.key ?? 0}`}
          className={`logger-art pixel-corners ${ex.isCompound ? '' : 'iso'} ${hit ? (hit.isPR ? 'shake flash' : 'flash') : ''}`}
          style={muscleStyle(main)}
        >
          <MuscleIcon muscle={main} size={64} />
        </div>
        <div className="logger-title">
          <h2 className="logger-name">{ex.name}</h2>
          <MuscleChips id={exerciseId} showSecondary />
        </div>
        {hit && <DamagePopup key={`hit-${hit.key}`} hit={hit} />}
      </div>

      {wp && (
        <p className="weakpoint">
          Weak point: {compoundFor(wp.lift).name} {fromKg(wp.targetWeightKg, unit)} × {wp.targetReps}
          <small>Reach {fromKg(wp.targetWeightKg, unit)} × {config.boss.minReps} or better to shatter the armor (×{config.boss.armorBreakMultiplier}).</small>
        </p>
      )}

      {lastTime.length > 0 && (
        <p className="last-time">Last time: {lastTime.map((s) => describeSet(s, settings, ex.isBodyweight)).join(', ')}</p>
      )}

      {meters && (
        <div className="panel pixel-corners">
          {ex.primaryMuscles.map((m) => (
            <MeterRow key={m} muscle={m} meter={meters[m]} />
          ))}
        </div>
      )}

      {lock && (
        <div className="lock-warning panel pixel-corners">
          <Pixel sprite={LOCK} size={32} />
          <span>{MUSCLE_INFO[lock].label} is at its fatigue cap. More sets are junk volume and deal no damage.</span>
        </div>
      )}

      <RestPanel session={session} settings={settings} />

      {mine.length > 0 && (
        <div className="logger-sets">
          {mine.map((s, i) => (
            <span key={s.id} className={`set-pill pixel-corners ${s.isWarmup ? 'set-warmup' : ''} ${s.isPR ? 'pr' : ''}`}>
              {s.isWarmup ? 'W' : mine.slice(0, i + 1).filter((x) => !x.isWarmup).length} · {describeSet(s, settings, ex.isBodyweight)}
              {!s.isWarmup && <span className="dmg">{s.damage ?? 0}</span>}
            </span>
          ))}
          {last && (
            <button className={`btn btn-ghost small ${undoArmed ? 'danger' : ''}`} onClick={() => confirmUndo(() => deleteSet(last.id!))}>
              {undoArmed ? 'Tap to undo' : 'Undo last'}
            </button>
          )}
        </div>
      )}

      <div className="logger-controls">
        {evaluation && (
          <div className="forecast panel pixel-corners">
            {evaluation.e1rm !== null && (
              <span className="forecast-item">
                <span className="forecast-label">Est. 1RM</span>
                <span className="forecast-value">{fromKg(evaluation.e1rm, unit)}</span>
              </span>
            )}
            {fight && (
              <span className="forecast-item forecast-dmg">
                <span className="forecast-label">Damage</span>
                <span className="forecast-value">{warmup ? '—' : forecast ? forecast.damage : 0}</span>
              </span>
            )}
            {evaluation.isPR && !warmup && (
              <span className="pr-badge pixel-corners">
                <Pixel sprite={CROWN} size={22} /> PR
              </span>
            )}
            {forecast?.armorBreak && <span className="pr-badge pixel-corners">SHATTER</span>}
            <span className="forecast-note">
              {warmup
                ? fight
                  ? `Warm-ups add no fatigue. They heal ${config.warmup.heal} and shield ${config.warmup.shield} (${config.warmup.perFight} per fight).`
                  : 'Warm-ups add no fatigue.'
                : !fight
                  ? 'Sets only deal damage in fights.'
                  : !target
                    ? 'No enemy here is weak to this card.'
                    : evaluation.baseline
                      ? '100 = a typical set from your last 3 workouts.'
                      : 'First time logging this: sets deal 100 while we learn your baseline.'}
            </span>
          </div>
        )}

        {fight && run && run.mode === 'run' && !warmup && (
          <ModifierPicker ex={ex} unlocked={unlocked} progress={progress} charges={run.charges} value={modifier} onChange={setModifier} />
        )}

        {!ex.isBodyweight && weight !== null && (
          <Stepper
            label={ex.perHand ? `Weight (${unit}, per hand)` : `Weight (${unit})`}
            value={weight}
            step={config.logging.weightStep[unit]}
            onChange={setWeight}
          />
        )}
        <Stepper label="Reps" value={reps} step={config.logging.repStep} min={1} decimals={0} onChange={setReps} />

        <button className={`toggle pixel-corners ${warmup ? 'toggle-on' : ''}`} onClick={() => setWarmup((w) => !w)} aria-pressed={warmup}>
          Warm-up set
        </button>

        <button className="btn btn-primary btn-huge pixel-corners" onClick={log} disabled={busy || weight === null}>
          {warmup ? 'Log warm-up' : `Strike! · Set ${workingCount + 1}`}
        </button>
        <button className="btn pixel-corners" onClick={() => finishExercise(session.id!, exerciseId)} disabled={workingCount === 0 && !lock}>
          {lock ? 'Discard card' : 'Finish exercise · draw a card'}
        </button>
      </div>
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { config } from '../../config';
import { getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';
import { allHistoryFor, deleteSet, finishExercise, getPrefill, logSet, setActiveExercise } from '../../db/repo';
import { lockedBy, type Meters } from '../../logic/fatigue';
import { evaluateSet } from '../../logic/strength';
import { fromKg, toKg } from '../../logic/units';
import type { LoggedSet, Session, Settings } from '../../types';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { CROWN, LOCK } from '../art/sprites';
import { buzz } from '../feedback';
import { useConfirm } from '../hooks';
import { DamagePopup, type Hit } from './DamagePopup';
import { MuscleChips, muscleStyle } from './ExerciseCard';
import { MeterRow } from './Meters';
import { RestTimer } from './RestTimer';
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
}: {
  session: Session;
  sessionSets: LoggedSet[];
  meters: Meters | undefined;
  exerciseId: string;
  settings: Settings;
}) {
  const ex = getExercise(exerciseId);
  const unit = settings.unit;
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number>(config.logging.defaultReps);
  const [warmup, setWarmup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hit, setHit] = useState<Hit | null>(null);
  const [undoArmed, confirmUndo] = useConfirm();

  useEffect(() => {
    let cancelled = false;
    getPrefill(exerciseId, unit).then((p) => {
      if (cancelled) return;
      setWeight(fromKg(p.weightKg, unit));
      setReps(p.reps);
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

  // Live forecast for the numbers on the steppers.
  const forecast =
    history && weight !== null
      ? evaluateSet(ex, { weightKg: ex.isBodyweight ? 0 : toKg(weight, unit), reps, isWarmup: warmup }, history, session.id)
      : null;

  const log = async () => {
    if (busy || weight === null) return;
    setBusy(true);
    try {
      const saved = await logSet({
        sessionId: session.id!,
        exerciseId,
        weightKg: ex.isBodyweight ? 0 : toKg(weight, unit),
        reps,
        isWarmup: warmup,
      });
      if (!saved.isWarmup) {
        setHit({ key: Date.now(), damage: saved.damage ?? 0, isPR: !!saved.isPR, junk: !!lock });
        buzz(settings, saved.isPR ? [60, 40, 60, 40, 160] : 50);
      } else {
        buzz(settings, 30);
      }
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
        <span className="logger-type">{ex.isCompound ? 'Compound' : 'Isolation'}</span>
      </div>

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
          <span>
            {MUSCLE_INFO[lock].label} is at its fatigue cap. More sets are junk volume and deal no damage.
          </span>
        </div>
      )}

      <RestTimer session={session} settings={settings} />

      {mine.length > 0 && (
        <div className="logger-sets">
          {mine.map((s, i) => (
            <span key={s.id} className={`set-pill pixel-corners ${s.isWarmup ? 'set-warmup' : ''} ${s.isPR ? 'pr' : ''}`}>
              {s.isWarmup ? 'W' : mine.slice(0, i + 1).filter((x) => !x.isWarmup).length} · {describeSet(s, settings, ex.isBodyweight)}
              {!s.isWarmup && <span className="dmg">{s.damage ?? 0}</span>}
            </span>
          ))}
          {last && (
            <button
              className={`btn btn-ghost small ${undoArmed ? 'danger' : ''}`}
              onClick={() => confirmUndo(() => deleteSet(last.id!))}
            >
              {undoArmed ? 'Tap to undo' : 'Undo last'}
            </button>
          )}
        </div>
      )}

      <div className="logger-controls">
        {forecast && (
          <div className="forecast panel pixel-corners">
            {forecast.e1rm !== null && (
              <span className="forecast-item">
                <span className="forecast-label">Est. 1RM</span>
                <span className="forecast-value">{fromKg(forecast.e1rm, unit)}</span>
              </span>
            )}
            <span className="forecast-item forecast-dmg">
              <span className="forecast-label">Damage</span>
              <span className="forecast-value">{warmup ? '—' : lock ? 0 : forecast.damage}</span>
            </span>
            {forecast.isPR && (
              <span className="pr-badge pixel-corners">
                <Pixel sprite={CROWN} size={22} /> PR
              </span>
            )}
            <span className="forecast-note">
              {warmup
                ? 'Warm-ups add no fatigue and deal no damage.'
                : forecast.baseline
                  ? '100 = a typical set from your last 3 workouts.'
                  : 'First time logging this: sets deal 100 while we learn your baseline.'}
            </span>
          </div>
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

        <button
          className={`toggle pixel-corners ${warmup ? 'toggle-on' : ''}`}
          onClick={() => setWarmup((w) => !w)}
          aria-pressed={warmup}
        >
          Warm-up set
        </button>

        <button className="btn btn-primary btn-huge pixel-corners" onClick={log} disabled={busy || weight === null}>
          {warmup ? 'Log warm-up' : `Strike! · Set ${workingCount + 1}`}
        </button>
        <button
          className="btn pixel-corners"
          onClick={() => finishExercise(session.id!, exerciseId)}
          disabled={workingCount === 0 && !lock}
        >
          {lock ? 'Discard card' : 'Finish exercise · draw a card'}
        </button>
      </div>
    </div>
  );
}

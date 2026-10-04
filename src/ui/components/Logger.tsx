import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { config } from '../../config';
import { getExercise } from '../../data/exercises';
import { deleteSet, finishExercise, getPrefill, historyFor, logSet, setActiveExercise } from '../../db/repo';
import { fromKg, toKg } from '../../logic/units';
import type { LoggedSet, Session, Settings } from '../../types';
import { buzz } from '../feedback';
import { useConfirm } from '../hooks';
import { MuscleChips } from './ExerciseCard';
import { RestTimer } from './RestTimer';
import { Stepper } from './Stepper';

function describeSet(s: LoggedSet, settings: Settings, bodyweight: boolean) {
  return bodyweight ? `${s.reps} reps` : `${fromKg(s.weightKg, settings.unit)} × ${s.reps}`;
}

export function Logger({
  session,
  sessionSets,
  exerciseId,
  settings,
}: {
  session: Session;
  sessionSets: LoggedSet[];
  exerciseId: string;
  settings: Settings;
}) {
  const ex = getExercise(exerciseId);
  const unit = settings.unit;
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number>(config.logging.defaultReps);
  const [warmup, setWarmup] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const lastTime = useLiveQuery(async () => {
    const hist = (await historyFor(exerciseId, 40)).filter((s) => s.sessionId !== session.id && !s.isWarmup);
    if (hist.length === 0) return [];
    const sid = hist[0].sessionId;
    return hist.filter((s) => s.sessionId === sid).reverse();
  }, [exerciseId, session.id]);

  const mine = sessionSets.filter((s) => s.exerciseId === exerciseId);
  const workingCount = mine.filter((s) => !s.isWarmup).length;

  const log = async () => {
    if (busy || weight === null) return;
    setBusy(true);
    try {
      await logSet({
        sessionId: session.id!,
        exerciseId,
        weightKg: ex.isBodyweight ? 0 : toKg(weight, unit),
        reps,
        isWarmup: warmup,
      });
      buzz(settings, 40);
    } finally {
      setBusy(false);
    }
  };

  const last = mine[mine.length - 1];

  return (
    <div className="logger">
      <div className="logger-top">
        <button className="btn btn-ghost" onClick={() => setActiveExercise(session.id!, undefined)}>
          ← Hand
        </button>
        <span className="muted small">{ex.isCompound ? 'Compound' : 'Isolation'}</span>
      </div>

      <h2 className="logger-name">{ex.name}</h2>
      <MuscleChips id={exerciseId} showSecondary />
      {lastTime && lastTime.length > 0 && (
        <p className="muted small last-time">
          Last time: {lastTime.map((s) => describeSet(s, settings, ex.isBodyweight)).join(', ')}
        </p>
      )}

      <RestTimer session={session} settings={settings} />

      <div className="logger-sets">
        {mine.map((s, i) => (
          <span key={s.id} className={`set-pill ${s.isWarmup ? 'set-warmup' : ''}`}>
            {s.isWarmup ? 'W' : mine.slice(0, i + 1).filter((x) => !x.isWarmup).length} ·{' '}
            {describeSet(s, settings, ex.isBodyweight)}
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

      <div className="logger-controls">
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
          className={`toggle ${warmup ? 'toggle-on' : ''}`}
          onClick={() => setWarmup((w) => !w)}
          aria-pressed={warmup}
        >
          {warmup ? '✓ Warm-up set (no fatigue)' : 'Warm-up set?'}
        </button>

        <button className="btn btn-primary btn-huge" onClick={log} disabled={busy || weight === null}>
          {warmup ? 'Log warm-up' : `Log set ${workingCount + 1}`}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => finishExercise(session.id!, exerciseId)}
          disabled={workingCount === 0}
        >
          Finish exercise → draw new card
        </button>
      </div>
    </div>
  );
}


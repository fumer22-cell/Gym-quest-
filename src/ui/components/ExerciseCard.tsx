import type { CSSProperties } from 'react';
import { getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';
import type { Muscle } from '../../types';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { LOCK } from '../art/sprites';

export function muscleStyle(m: Muscle): CSSProperties {
  return { '--muscle': MUSCLE_INFO[m].color } as CSSProperties;
}

export function MuscleChips({ id, showSecondary = false }: { id: string; showSecondary?: boolean }) {
  const ex = getExercise(id);
  return (
    <div className="chips">
      {ex.primaryMuscles.map((m) => (
        <span key={m} className="chip pixel-corners" style={muscleStyle(m)}>
          <MuscleIcon muscle={m} size={16} />
          {MUSCLE_INFO[m].short}
        </span>
      ))}
      {showSecondary &&
        ex.secondaryMuscles.map((m) => (
          <span key={m} className="chip chip-secondary pixel-corners" style={muscleStyle(m)}>
            <MuscleIcon muscle={m} size={16} />
            {MUSCLE_INFO[m].short}
          </span>
        ))}
    </div>
  );
}

export function ExerciseCard({
  id,
  setsDone,
  lockedBy,
  onPlay,
  onSwap,
  onDiscard,
}: {
  id: string;
  setsDone: number;
  lockedBy: Muscle | null;
  onPlay: () => void;
  onSwap: () => void;
  onDiscard: () => void;
}) {
  const ex = getExercise(id);
  const main = ex.primaryMuscles[0];
  const primary = ex.primaryMuscles.map((m) => MUSCLE_INFO[m].short).join(' + ');
  const secondary = ex.secondaryMuscles.map((m) => MUSCLE_INFO[m].short).join(', ');
  return (
    <div className={`card ${ex.isCompound ? '' : 'card-iso'} ${lockedBy ? 'card-locked' : ''}`} style={muscleStyle(main)}>
      <span className="card-orb outlined" title="Working sets this workout">{setsDone}</span>
      <button className="card-play pixel-corners" onClick={onPlay} disabled={!!lockedBy} aria-label={`Play ${ex.name}`}>
        <span className="card-banner pixel-corners">{ex.name}</span>
        <span className="card-art">
          <MuscleIcon muscle={main} size={64} />
        </span>
        <span className="card-type pixel-corners">{ex.isCompound ? 'Compound' : 'Isolation'}</span>
        <span className="card-text">
          Strike <b>{primary}</b>
          {secondary && <>. Grazes {secondary}</>}.
        </span>
      </button>
      {!lockedBy && (
        <button className="card-swap outlined" onClick={onSwap} aria-label="Machine taken: swap for a similar exercise">
          ⇄
        </button>
      )}
      {lockedBy && (
        <div className="card-lock">
          <Pixel sprite={LOCK} size={48} />
          <span className="card-lock-text outlined">{MUSCLE_INFO[lockedBy].label} at fatigue cap</span>
          <button className="btn pixel-corners" onClick={onDiscard}>Discard</button>
        </div>
      )}
    </div>
  );
}

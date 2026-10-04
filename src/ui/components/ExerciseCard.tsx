import { getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';

export function MuscleChips({ id, showSecondary = false }: { id: string; showSecondary?: boolean }) {
  const ex = getExercise(id);
  return (
    <div className="chips">
      {ex.primaryMuscles.map((m) => (
        <span key={m} className="chip" style={{ background: MUSCLE_INFO[m].color }}>
          {MUSCLE_INFO[m].short}
        </span>
      ))}
      {showSecondary &&
        ex.secondaryMuscles.map((m) => (
          <span key={m} className="chip chip-secondary" style={{ borderColor: MUSCLE_INFO[m].color }}>
            {MUSCLE_INFO[m].short}
          </span>
        ))}
    </div>
  );
}

export function ExerciseCard({
  id,
  setsDone,
  onPlay,
  onSwap,
}: {
  id: string;
  setsDone: number;
  onPlay: () => void;
  onSwap: () => void;
}) {
  const ex = getExercise(id);
  const color = MUSCLE_INFO[ex.primaryMuscles[0]].color;
  return (
    <div className="card" style={{ borderTopColor: color }}>
      <button className="card-play" onClick={onPlay} aria-label={`Play ${ex.name}`}>
        <span className="card-type">{ex.isCompound ? 'Compound' : 'Isolation'}</span>
        <span className="card-name">{ex.name}</span>
        <MuscleChips id={id} />
        {setsDone > 0 && <span className="card-badge">{setsDone} sets</span>}
      </button>
      <button className="card-swap" onClick={onSwap} aria-label="Machine taken — swap for a similar exercise">
        ⇄
      </button>
    </div>
  );
}

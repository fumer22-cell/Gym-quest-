import type { CSSProperties } from 'react';
import { getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';
import type { Muscle } from '../../types';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { masteryTier } from '../../logic/mastery';
import { LOCK, SWIRL } from '../art/sprites';

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
  mastery = 0,
  disrupted,
  highlight,
  runCard,
  onPlay,
  onSwap,
  onDiscard,
}: {
  id: string;
  setsDone: number;
  lockedBy: Muscle | null;
  /** Card mastery level (frame tier + small damage bonus). */
  mastery?: number;
  /** Locked by an enemy's Disrupt for this turn. */
  disrupted?: boolean;
  /** Glows (e.g. a valid second card for a superset). */
  highlight?: boolean;
  /** Temporary card dropped this run. */
  runCard?: boolean;
  onPlay: () => void;
  onSwap?: () => void;
  onDiscard: () => void;
}) {
  const ex = getExercise(id);
  const tier = masteryTier(mastery).toLowerCase();
  const main = ex.primaryMuscles[0];
  const primary = ex.primaryMuscles.map((m) => MUSCLE_INFO[m].short).join(' + ');
  const secondary = ex.secondaryMuscles.map((m) => MUSCLE_INFO[m].short).join(', ');
  return (
    <div
      className={`card ${ex.isCompound ? '' : 'card-iso'} ${lockedBy || disrupted ? 'card-locked' : ''} card-tier-${tier} ${highlight ? 'card-glow' : ''}`}
      style={muscleStyle(main)}
    >
      <span className="card-orb outlined" title="Working sets this workout">{setsDone}</span>
      <button className="card-play pixel-corners" onClick={onPlay} disabled={!!lockedBy || disrupted} aria-label={`Play ${ex.name}`}>
        <span className="card-banner pixel-corners">{ex.name}</span>
        <span className="card-art">
          <MuscleIcon muscle={main} size={64} />
        </span>
        <span className="card-type pixel-corners">
          {ex.isCompound ? 'Compound' : 'Isolation'}
          {mastery > 0 && ` · Lv ${mastery}`}
        </span>
        {runCard && <span className="card-run">Run card</span>}
        <span className="card-text">
          Strike <b>{primary}</b>
          {secondary && <>. Grazes {secondary}</>}.
        </span>
      </button>
      {!lockedBy && !disrupted && onSwap && (
        <button className="card-swap outlined" onClick={onSwap} aria-label="Machine taken: swap for a similar exercise">
          ⇄
        </button>
      )}
      {disrupted && !lockedBy && (
        <div className="card-lock">
          <Pixel sprite={SWIRL} size={48} recolor={{ p: '#c06fd8' }} />
          <span className="card-lock-text outlined">Disrupted this turn</span>
        </div>
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

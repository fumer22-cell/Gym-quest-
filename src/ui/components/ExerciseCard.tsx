import type { CSSProperties } from 'react';
import { getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';
import { masteryTier } from '../../logic/mastery';
import type { Muscle } from '../../types';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { LOCK, SWIRL } from '../art/sprites';

export function muscleStyle(m: Muscle): CSSProperties {
  return { '--muscle': MUSCLE_INFO[m].color } as CSSProperties;
}

export function MuscleChips({ id, showSecondary = false }: { id: string; showSecondary?: boolean }) {
  const ex = getExercise(id);
  return (
    <div className="chips">
      {ex.primaryMuscles.map((m) => (
        <span key={m} className="chip" style={muscleStyle(m)}>
          <MuscleIcon muscle={m} size={14} />
          {MUSCLE_INFO[m].short}
        </span>
      ))}
      {showSecondary &&
        ex.secondaryMuscles.map((m) => (
          <span key={m} className="chip chip-secondary" style={muscleStyle(m)}>
            {MUSCLE_INFO[m].short}
          </span>
        ))}
    </div>
  );
}

export interface CardInfo {
  id: string;
  setsDone?: number;
  lockedBy?: Muscle | null;
  mastery?: number;
  disrupted?: boolean;
  highlight?: boolean;
  runCard?: boolean;
}

/**
 * A deck-builder card. All of its type is sized from the card's own width (container units),
 * so the same card reads well fanned in the hand, on a reward screen or as a thumbnail.
 */
export function GameCard({ card, selected }: { card: CardInfo; selected?: boolean }) {
  const ex = getExercise(card.id);
  const main = ex.primaryMuscles[0];
  const tier = masteryTier(card.mastery ?? 0).toLowerCase();
  const primary = ex.primaryMuscles.map((m) => MUSCLE_INFO[m].short).join(' + ');
  const secondary = ex.secondaryMuscles.map((m) => MUSCLE_INFO[m].short).join(', ');
  const blocked = !!card.lockedBy || card.disrupted;
  return (
    <div
      className={`gcard ${ex.isCompound ? 'gcard-compound' : 'gcard-iso'} tier-${tier} ${blocked ? 'gcard-blocked' : ''} ${card.highlight ? 'gcard-glow' : ''} ${selected ? 'gcard-selected' : ''}`}
      style={muscleStyle(main)}
    >
      <div className="gcard-frame">
        <span className="gcard-orb outlined">{card.setsDone ?? 0}</span>
        <span className="gcard-name">{ex.name}</span>
        <span className="gcard-art">
          <MuscleIcon muscle={main} size={64} />
        </span>
        <span className="gcard-type">
          {ex.isCompound ? 'Compound' : 'Isolation'}
          {(card.mastery ?? 0) > 0 && ` ${card.mastery}`}
        </span>
        <span className="gcard-text">
          <b>{primary}</b>
          {secondary && <> · {secondary}</>}
        </span>
        {card.runCard && <span className="gcard-run">RUN</span>}
      </div>
      {card.lockedBy && (
        <span className="gcard-overlay">
          <Pixel sprite={LOCK} size={40} />
          <span className="outlined">{MUSCLE_INFO[card.lockedBy].short} capped</span>
        </span>
      )}
      {card.disrupted && !card.lockedBy && (
        <span className="gcard-overlay">
          <Pixel sprite={SWIRL} size={40} recolor={{ p: '#c06fd8' }} />
          <span className="outlined">Disrupted</span>
        </span>
      )}
    </div>
  );
}

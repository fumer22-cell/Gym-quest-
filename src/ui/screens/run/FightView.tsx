import { useState } from 'react';
import { getExercise } from '../../../data/exercises';
import { fleeFight, setTarget } from '../../../db/quest';
import { finishExercise, setActiveExercise, swapExercise } from '../../../db/repo';
import { lockedBy, type Meters } from '../../../logic/fatigue';
import { areOpposite } from '../../../logic/modifiers';
import type { LoggedSet, Session, Settings } from '../../../types';
import { EnemyCard, Hud } from '../../components/Combat';
import { ExerciseCard } from '../../components/ExerciseCard';
import { MeterGrid } from '../../components/Meters';
import { RestPanel } from '../../components/RestPanel';
import { useConfirm } from '../../hooks';

export function FightView({ session, settings, sets, meters, mastery }: {
  session: Session;
  settings: Settings;
  sets: LoggedSet[];
  meters?: Meters;
  mastery: Record<string, number>;
}) {
  const run = session.run!;
  const f = run.fight!;
  const [fleeArmed, confirmFlee] = useConfirm();
  const [toast, setToast] = useState<string | null>(null);
  const working = sets.filter((s) => !s.isWarmup);
  const reveal = (f.revealUntilTurn ?? 0) > f.turn;
  const sup = f.superset ? getExercise(f.superset.firstExerciseId) : undefined;
  const boss = f.enemies.find((e) => e.isBoss);

  const swap = async (id: string) => {
    if (!(await swapExercise(session.id!, id))) {
      setToast('No similar exercise left to swap in.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <>
      <Hud run={run} event={f.lastEvent} />
      {boss?.nemesisId && <p className="nemesis-banner outlined">Your nemesis returns!</p>}
      <div className={`enemies enemies-${f.enemies.length}`}>
        {f.enemies.map((e) => (
          <EnemyCard
            key={e.id}
            enemy={e}
            unit={settings.unit}
            selected={f.enemies.length > 1 && e.id === f.targetId}
            reveal={reveal}
            event={f.lastEvent}
            onSelect={f.enemies.length > 1 ? () => setTarget(session.id!, e.id) : undefined}
          />
        ))}
      </div>
      {f.enemies.length > 1 && <p className="hint">Tap an enemy to target it</p>}
      {run.log.length > 0 && <p className="combat-log">{run.log[run.log.length - 1]}</p>}

      <RestPanel session={session} settings={settings} />

      {sup && (
        <p className="superset-banner panel pixel-corners">
          Superset! Now play a card that works the opposite muscles of {sup.name}. It hits the other enemy.
        </p>
      )}

      <h3 className="section-title">Your hand</h3>
      {session.hand.length === 0 ? (
        <p className="muted center-text">No card can hit these enemies right now. Leave the fight to move on.</p>
      ) : (
        <div className="hand">
          {session.hand.map((id) => (
            <ExerciseCard
              key={id}
              id={id}
              setsDone={working.filter((s) => s.exerciseId === id).length}
              lockedBy={meters ? lockedBy(getExercise(id), meters) : null}
              mastery={mastery[id] ?? 0}
              disrupted={f.disrupted === id}
              highlight={!!sup && areOpposite(sup, getExercise(id)) && id !== sup.id}
              runCard={run.runCards.includes(id)}
              onPlay={() => setActiveExercise(session.id!, id)}
              onSwap={() => swap(id)}
              onDiscard={() => finishExercise(session.id!, id)}
            />
          ))}
        </div>
      )}

      {meters && (
        <details className="panel pixel-corners meters-fold">
          <summary>Muscle meters</summary>
          <MeterGrid meters={meters} />
        </details>
      )}

      <button className={`btn btn-ghost ${fleeArmed ? 'danger' : ''}`} onClick={() => confirmFlee(() => fleeFight(session.id!))}>
        {fleeArmed
          ? boss && !boss.armorBroken
            ? `Tap again: ${boss.name} escapes`
            : 'Tap again to leave (no rewards)'
          : 'Leave fight'}
      </button>
      {toast && <div className="toast panel pixel-corners">{toast}</div>}
    </>
  );
}

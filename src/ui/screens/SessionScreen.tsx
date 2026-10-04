import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getExercise } from '../../data/exercises';
import { endSession, setActiveExercise, setsForSession, swapExercise } from '../../db/repo';
import { fromKg } from '../../logic/units';
import { groupByExercise } from '../../logic/volume';
import type { LoggedSet, Session, Settings } from '../../types';
import type { Route } from '../App';
import { ExerciseCard } from '../components/ExerciseCard';
import { Logger } from '../components/Logger';
import { RestTimer } from '../components/RestTimer';
import { formatClock, useConfirm, useNow } from '../hooks';

export function SessionScreen({ session, settings, go }: { session: Session; settings: Settings; go: (r: Route) => void }) {
  const sets = useLiveQuery(() => setsForSession(session.id!), [session.id], [] as LoggedSet[]);
  const now = useNow(1000);
  const [finishArmed, confirmFinish] = useConfirm();
  const [toast, setToast] = useState<string | null>(null);

  if (session.activeExerciseId) {
    return (
      <div className="screen">
        <Logger
          key={session.activeExerciseId}
          session={session}
          sessionSets={sets}
          exerciseId={session.activeExerciseId}
          settings={settings}
        />
      </div>
    );
  }

  const swap = async (id: string) => {
    const ok = await swapExercise(session.id!, id);
    if (!ok) {
      setToast('No similar exercise left to swap in.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const finish = () =>
    confirmFinish(async () => {
      await endSession(session.id!);
      go({ name: 'summary', sessionId: session.id! });
    });

  const working = sets.filter((s) => !s.isWarmup);
  const grouped = groupByExercise(sets);

  return (
    <div className="screen session">
      <div className="topbar">
        <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>
          ← Home
        </button>
        <div className="topbar-mid">
          <div className="small muted">Workout</div>
          <div className="clock">{formatClock((now - session.startedAt) / 1000)}</div>
        </div>
        <button className={`btn btn-ghost ${finishArmed ? 'danger' : ''}`} onClick={finish}>
          {finishArmed ? 'Tap again' : 'Finish'}
        </button>
      </div>

      <RestTimer session={session} settings={settings} />

      <h3 className="section-title">Your hand</h3>
      <div className="hand">
        {session.hand.map((id) => (
          <ExerciseCard
            key={id}
            id={id}
            setsDone={working.filter((s) => s.exerciseId === id).length}
            onPlay={() => setActiveExercise(session.id!, id)}
            onSwap={() => swap(id)}
          />
        ))}
      </div>
      <p className="muted small hint">Tap a card to play it. ⇄ = machine taken, swap it.</p>

      {grouped.length > 0 && (
        <>
          <h3 className="section-title">This workout · {working.length} working sets</h3>
          <ul className="log-list">
            {grouped.map(([exId, exSets]) => {
              const ex = getExercise(exId);
              return (
                <li key={exId}>
                  <button className="log-row" onClick={() => setActiveExercise(session.id!, exId)}>
                    <span className="log-name">{ex.name}</span>
                    <span className="log-sets">
                      {exSets
                        .map((s) =>
                          (s.isWarmup ? 'W ' : '') +
                          (ex.isBodyweight ? `${s.reps}` : `${fromKg(s.weightKg, settings.unit)}×${s.reps}`),
                        )
                        .join('  ')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}


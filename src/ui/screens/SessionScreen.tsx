import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getExercise } from '../../data/exercises';
import { endSession, finishExercise, getMeters, setActiveExercise, setsForSession, swapExercise } from '../../db/repo';
import { lockedBy } from '../../logic/fatigue';
import { fromKg } from '../../logic/units';
import { groupByExercise } from '../../logic/volume';
import type { LoggedSet, Session, Settings } from '../../types';
import type { Route } from '../App';
import { ExerciseCard } from '../components/ExerciseCard';
import { Logger } from '../components/Logger';
import { MeterGrid } from '../components/Meters';
import { RestTimer } from '../components/RestTimer';
import { formatClock, useConfirm, useNow } from '../hooks';

export function SessionScreen({ session, settings, go }: { session: Session; settings: Settings; go: (r: Route) => void }) {
  const sets = useLiveQuery(() => setsForSession(session.id!), [session.id], [] as LoggedSet[]);
  const meters = useLiveQuery(() => getMeters(session.id!), [session.id]);
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
          meters={meters}
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
  const totalDamage = working.reduce((sum, s) => sum + (s.damage ?? 0), 0);
  const grouped = groupByExercise(sets);

  return (
    <div className="screen session">
      <div className="topbar">
        <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>
          ← Camp
        </button>
        <div className="topbar-mid">
          <div className="clock outlined">{formatClock((now - session.startedAt) / 1000)}</div>
          <div className="small muted">{totalDamage} damage dealt</div>
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
            lockedBy={meters ? lockedBy(getExercise(id), meters) : null}
            onPlay={() => setActiveExercise(session.id!, id)}
            onSwap={() => swap(id)}
            onDiscard={() => finishExercise(session.id!, id)}
          />
        ))}
      </div>
      <p className="hint">Tap a card to play it · ⇄ machine taken</p>

      {meters && (
        <>
          <h3 className="section-title">Muscle meters</h3>
          <div className="panel pixel-corners">
            <MeterGrid meters={meters} />
          </div>
        </>
      )}

      {grouped.length > 0 && (
        <>
          <h3 className="section-title">This workout · {working.length} sets</h3>
          <ul className="log-list">
            {grouped.map(([exId, exSets]) => {
              const ex = getExercise(exId);
              const dmg = exSets.reduce((sum, s) => sum + (s.damage ?? 0), 0);
              return (
                <li key={exId}>
                  <button className="log-row pixel-corners" onClick={() => setActiveExercise(session.id!, exId)}>
                    <div>
                      <div className="log-name">{ex.name}</div>
                      <div className="log-sets">
                        {exSets
                          .map(
                            (s) =>
                              (s.isWarmup ? 'W ' : s.isPR ? '★' : '') +
                              (ex.isBodyweight ? `${s.reps}` : `${fromKg(s.weightKg, settings.unit)}×${s.reps}`),
                          )
                          .join('  ')}
                      </div>
                    </div>
                    <span className="log-dmg">{dmg}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {toast && <div className="toast panel pixel-corners">{toast}</div>}
    </div>
  );
}

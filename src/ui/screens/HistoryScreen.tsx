import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getExercise } from '../../data/exercises';
import { db } from '../../db/db';
import { deleteSession, setsForSession } from '../../db/repo';
import { fromKg } from '../../logic/units';
import { groupByExercise } from '../../logic/volume';
import type { Session, Settings } from '../../types';
import type { Route } from '../App';
import { MuscleIcon } from '../art/Pixel';
import { formatClock, useConfirm } from '../hooks';
import { Screen, TopBar } from '../layout/Screen';

export function HistoryScreen({ settings, go }: { settings: Settings; go: (r: Route) => void }) {
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), []);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Screen scene="calm" floor={false} torches={false} className="list-screen">
      <TopBar
        left={<button className="icon-btn" onClick={() => go({ name: 'home' })} aria-label="Back to camp">←</button>}
        center={<h1 className="screen-title outlined">Chronicle</h1>}
      />
      <div className="scroll-area">
        {sessions?.length === 0 && <p className="center-text muted">No quests yet. Finished workouts appear here.</p>}
        <ul className="list">
          {sessions?.map((s) => (
            <HistoryItem key={s.id} session={s} settings={settings} open={open === s.id} toggle={() => setOpen(open === s.id ? null : s.id!)} />
          ))}
        </ul>
      </div>
    </Screen>
  );
}

function HistoryItem({ session, settings, open, toggle }: { session: Session; settings: Settings; open: boolean; toggle: () => void }) {
  const sets = useLiveQuery(() => setsForSession(session.id!), [session.id]);
  const [armed, confirm] = useConfirm();
  const working = sets?.filter((s) => !s.isWarmup) ?? [];
  const dmg = working.reduce((s, x) => s + (x.damage ?? 0), 0);
  const d = new Date(session.startedAt);
  const duration = session.endedAt ? formatClock((session.endedAt - session.startedAt) / 1000) : 'in progress';
  const tag = session.run?.mode === 'training' ? 'Training' : session.run?.cleared ? 'Cleared' : session.run ? 'Quest' : 'Workout';
  return (
    <li className="list-item panel">
      <button className="list-head" onClick={toggle} aria-expanded={open}>
        <span>
          <b>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</b>
          <span className={`tag tag-${tag.toLowerCase()}`}>{tag}</span>
        </span>
        <span className="muted small">
          {working.length} sets · {dmg} dmg · {duration}
        </span>
      </button>
      {open && sets && (
        <div className="list-body">
          {groupByExercise(sets).map(([exId, exSets]) => {
            const ex = getExercise(exId);
            return (
              <div key={exId} className="list-row">
                <MuscleIcon muscle={ex.primaryMuscles[0]} size={22} />
                <span className="grow">
                  {ex.name}
                  <small className="muted">
                    {' '}
                    {exSets.map((s) => (s.isWarmup ? 'W ' : s.isPR ? '★' : '') + (ex.isBodyweight ? `${s.reps}` : `${fromKg(s.weightKg, settings.unit)}×${s.reps}`)).join(' · ')}
                  </small>
                </span>
              </div>
            );
          })}
          <button className={`btn btn-small ${armed ? 'btn-danger' : 'btn-ghost'}`} onClick={() => confirm(() => deleteSession(session.id!))}>
            {armed ? 'Tap again to delete' : 'Delete this workout'}
          </button>
        </div>
      )}
    </li>
  );
}

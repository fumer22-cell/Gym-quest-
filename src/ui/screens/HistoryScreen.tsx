import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteSession, setsForSession } from '../../db/repo';
import type { Session, Settings } from '../../types';
import type { Route } from '../App';
import { SessionDetail } from '../components/SessionDetail';
import { formatClock, useConfirm } from '../hooks';

export function HistoryScreen({ settings, go }: { settings: Settings; go: (r: Route) => void }) {
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), []);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>← Home</button>
        <div className="topbar-mid"><div className="clock">History</div></div>
        <span style={{ width: 64 }} />
      </div>
      {sessions?.length === 0 && <p className="muted center-text">No workouts yet.</p>}
      <ul className="history-list">
        {sessions?.map((s) => (
          <HistoryItem key={s.id} session={s} settings={settings} open={open === s.id} toggle={() => setOpen(open === s.id ? null : s.id!)} />
        ))}
      </ul>
    </div>
  );
}

function HistoryItem({ session, settings, open, toggle }: { session: Session; settings: Settings; open: boolean; toggle: () => void }) {
  const sets = useLiveQuery(() => setsForSession(session.id!), [session.id]);
  const [armed, confirm] = useConfirm();
  const working = sets?.filter((s) => !s.isWarmup).length ?? 0;
  const d = new Date(session.startedAt);
  const duration = session.endedAt ? formatClock((session.endedAt - session.startedAt) / 1000) : 'in progress';
  return (
    <li className="history-item">
      <button className="history-head" onClick={toggle}>
        <span>
          <strong>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>{' '}
          <span className="muted small">{d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
        </span>
        <span className="muted small">{working} sets · {duration}</span>
      </button>
      {open && sets && (
        <>
          <SessionDetail sets={sets} settings={settings} />
          <button className={`btn btn-ghost small ${armed ? 'danger' : ''}`} onClick={() => confirm(() => deleteSession(session.id!))}>
            {armed ? 'Tap again to delete' : 'Delete workout'}
          </button>
        </>
      )}
    </li>
  );
}

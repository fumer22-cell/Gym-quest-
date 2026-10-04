import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { setsForSession } from '../../db/repo';
import type { Settings } from '../../types';
import type { Route } from '../App';
import { SessionDetail } from '../components/SessionDetail';
import { formatClock } from '../hooks';

export function SummaryScreen({ sessionId, settings, go }: { sessionId: number; settings: Settings; go: (r: Route) => void }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useLiveQuery(() => setsForSession(sessionId), [sessionId]);
  if (!session || !sets) return <div className="screen center muted">Loading…</div>;
  const working = sets.filter((s) => !s.isWarmup).length;
  const duration = ((session.endedAt ?? Date.now()) - session.startedAt) / 1000;

  return (
    <div className="screen">
      <h1 className="summary-title">Quest complete!</h1>
      <div className="stat-row">
        <div className="stat"><div className="stat-num">{formatClock(duration)}</div><div className="muted small">time</div></div>
        <div className="stat"><div className="stat-num">{working}</div><div className="muted small">working sets</div></div>
      </div>
      <SessionDetail sets={sets} settings={settings} />
      <div className="bottom-actions">
        <button className="btn btn-primary btn-huge" onClick={() => go({ name: 'home' })}>Done</button>
      </div>
    </div>
  );
}

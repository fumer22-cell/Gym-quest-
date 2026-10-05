import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { setsForSession } from '../../db/repo';
import type { Settings } from '../../types';
import type { Route } from '../App';
import { Pixel } from '../art/Pixel';
import { CROWN, SWORD } from '../art/sprites';
import { SessionDetail } from '../components/SessionDetail';
import { formatClock } from '../hooks';
import { getExercise } from '../../data/exercises';
import { bossLine } from './run/RunEndView';

export function SummaryScreen({ sessionId, settings, go }: { sessionId: number; settings: Settings; go: (r: Route) => void }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useLiveQuery(() => setsForSession(sessionId), [sessionId]);
  if (!session || !sets) return <div className="screen center muted">Loading…</div>;
  const working = sets.filter((s) => !s.isWarmup);
  const damage = working.reduce((sum, s) => sum + (s.damage ?? 0), 0);
  const prs = working.filter((s) => s.isPR).length;
  const duration = ((session.endedAt ?? Date.now()) - session.startedAt) / 1000;

  return (
    <div className="screen">
      <h1 className="summary-title outlined">
        {session.run?.mode === 'training' ? 'Training complete!' : session.run?.cleared ? 'Quest cleared!' : 'Quest complete!'}
      </h1>
      {session.run && bossLine(session, (settings.nemeses ?? []).find((n) => n.id === session.run?.nemesisId)?.name) && (
        <p className="center-text">{bossLine(session, (settings.nemeses ?? []).find((n) => n.id === session.run?.nemesisId)?.name)}</p>
      )}
      {session.run?.keptCard && <p className="center-text good">{getExercise(session.run.keptCard).name} joined your deck for good.</p>}
      <div className="stat-row">
        <div className="stat panel pixel-corners">
          <div className="stat-num dmg"><Pixel sprite={SWORD} size={24} />{damage}</div>
          <div className="stat-label">Damage</div>
        </div>
        <div className="stat panel pixel-corners">
          <div className="stat-num"><Pixel sprite={CROWN} size={24} />{prs}</div>
          <div className="stat-label">PRs</div>
        </div>
        <div className="stat panel pixel-corners">
          <div className="stat-num">{working.length}</div>
          <div className="stat-label">Sets</div>
        </div>
        <div className="stat panel pixel-corners">
          <div className="stat-num">{formatClock(duration)}</div>
          <div className="stat-label">Time</div>
        </div>
      </div>
      <div className="panel pixel-corners">
        <SessionDetail sets={sets} settings={settings} />
      </div>
      <div className="bottom-actions">
        <button className="btn btn-primary btn-huge pixel-corners" onClick={() => go({ name: 'home' })}>Return to camp</button>
      </div>
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { getExercise } from '../../data/exercises';
import { db } from '../../db/db';
import { setsForSession } from '../../db/repo';
import { muscleMeters } from '../../logic/fatigue';
import type { Settings } from '../../types';
import type { Route } from '../App';
import { MeterGrid } from '../components/Meters';
import { Screen } from '../layout/Screen';
import { bossLine, StatTiles } from './run/RunEndView';

export function SummaryScreen({ sessionId, settings, go }: { sessionId: number; settings: Settings; go: (r: Route) => void }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useLiveQuery(() => setsForSession(sessionId), [sessionId]);
  if (!session || !sets) return <div className="app"><p className="center-fill muted">Loading…</p></div>;
  const run = session.run;
  const line = run ? bossLine(session, (settings.nemeses ?? []).find((n) => n.id === run.nemesisId)?.name) : null;
  return (
    <Screen scene={run?.cleared || run?.mode === 'training' ? 'victory' : 'camp'} floor={false} className="summary-screen">
      <div className="end-head">
        <h1 className="title-banner outlined">{run?.mode === 'training' ? 'Training complete!' : run?.cleared ? 'Quest cleared!' : 'Quest complete!'}</h1>
        {line && <p>{line}</p>}
        {run?.keptCard && <p className="good">{getExercise(run.keptCard).name} joined your deck for good.</p>}
      </div>
      <StatTiles sets={sets} startedAt={session.startedAt} endedAt={session.endedAt ?? Date.now()} />
      <div className="panel end-meters">
        <MeterGrid meters={muscleMeters(sets, [], 0)} />
      </div>
      <div className="grow" />
      <div className="actions">
        <button className="btn btn-primary btn-big" onClick={() => go({ name: 'home' })}>Return to camp</button>
      </div>
    </Screen>
  );
}

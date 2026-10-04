import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { startSession } from '../../db/repo';
import { useStorageInfo } from '../../db/sync';
import type { Session } from '../../types';
import type { Route } from '../App';

export function HomeScreen({ active, go }: { active: Session | null; go: (r: Route) => void }) {
  const lastDone = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().filter((s) => !!s.endedAt).first(), []);

  const storage = useStorageInfo();

  const begin = async () => {
    await startSession();
    go({ name: 'session' });
  };

  return (
    <div className="screen home">
      <header className="home-title">
        <div className="logo">⚔️</div>
        <h1>Gym Quest</h1>
        <p className="muted">
          {lastDone ? `Last quest: ${new Date(lastDone.startedAt).toLocaleDateString()}` : 'Your first quest awaits.'}
        </p>
      </header>

      <div className="bottom-actions">
        <button className="btn btn-primary btn-huge" onClick={active ? () => go({ name: 'session' }) : begin}>
          {active ? 'Resume workout' : 'Start workout'}
        </button>
        <div className="row">
          <button className="btn btn-secondary grow" onClick={() => go({ name: 'history' })}>
            History
          </button>
          <button className="btn btn-secondary grow" onClick={() => go({ name: 'settings' })}>
            Settings
          </button>
        </div>
        <p className={`small center-text storage-line storage-${storage.state}`}>{storage.label}</p>
      </div>
    </div>
  );
}

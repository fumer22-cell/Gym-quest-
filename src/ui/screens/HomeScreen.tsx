import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { startSession } from '../../db/repo';
import { useStorageInfo } from '../../db/sync';
import type { Session } from '../../types';
import type { Route } from '../App';
import { Campfire } from '../art/Pixel';

export function HomeScreen({ active, go, calibrated = true }: { active: Session | null; go: (r: Route) => void; calibrated?: boolean }) {
  const lastDone = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().filter((s) => !!s.endedAt).first(), []);
  const storage = useStorageInfo();

  const begin = async () => {
    await startSession();
    go({ name: 'session' });
  };

  return (
    <div className="screen home">
      <header className="home-title">
        <h1>
          GYM
          <br />
          QUEST
        </h1>
        <p className="home-sub">A strength roguelike</p>
        <div className="campfire-wrap">
          <Campfire size={128} />
        </div>
        <p className="home-last">
          {lastDone
            ? `Last quest: ${new Date(lastDone.startedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`
            : 'Rest by the fire. Your first quest awaits.'}
        </p>
      </header>

      <div className="bottom-actions">
        <button className="btn btn-primary btn-huge pixel-corners" onClick={active ? () => go({ name: 'session' }) : begin}>
          {active ? 'Resume quest' : calibrated ? 'Begin quest' : 'Enter Training Grounds'}
        </button>
        <div className="row">
          <button className="btn grow pixel-corners" onClick={() => go({ name: 'character' })}>
            Character
          </button>
          <button className="btn grow pixel-corners" onClick={() => go({ name: 'history' })}>
            Chronicle
          </button>
          <button className="btn grow pixel-corners" onClick={() => go({ name: 'settings' })}>
            Settings
          </button>
        </div>
        <p className={`center-text storage-line storage-${storage.state}`}>{storage.label}</p>
      </div>
    </div>
  );
}

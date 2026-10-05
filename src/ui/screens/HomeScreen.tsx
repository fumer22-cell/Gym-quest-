import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { startSession } from '../../db/repo';
import { useStorageInfo } from '../../db/sync';
import type { Session } from '../../types';
import type { Route } from '../App';
import { Campfire, Pixel } from '../art/Pixel';
import { HERO } from '../art/sprites';
import { Screen } from '../layout/Screen';

export function HomeScreen({ active, go, calibrated = true }: { active: Session | null; go: (r: Route) => void; calibrated?: boolean }) {
  const lastDone = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().filter((s) => !!s.endedAt).first(), []);
  const storage = useStorageInfo();

  const begin = async () => {
    await startSession();
    go({ name: 'session' });
  };

  return (
    <Screen scene="camp" className="home">
      <header className="home-title">
        <h1 className="logo">
          <span>GYM</span>
          <span>QUEST</span>
        </h1>
        <p className="home-sub">A strength roguelike</p>
      </header>
      <div className="home-camp">
        <span className="home-hero anim-breathe">
          <Pixel sprite={HERO} size={88} />
        </span>
        <span className="home-fire">
          <Campfire size={120} />
        </span>
      </div>
      <p className="home-last">
        {lastDone
          ? `Last quest: ${new Date(lastDone.startedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`
          : 'Rest by the fire. Your first quest awaits.'}
      </p>
      <div className="actions">
        <button className="btn btn-primary btn-big btn-glow" onClick={active ? () => go({ name: 'session' }) : begin}>
          {active ? 'Resume quest' : calibrated ? 'Begin quest' : 'Enter Training Grounds'}
        </button>
        <div className="row">
          <button className="btn grow" onClick={() => go({ name: 'character' })}>Hero</button>
          <button className="btn grow" onClick={() => go({ name: 'history' })}>Chronicle</button>
          <button className="btn grow" onClick={() => go({ name: 'settings' })}>Settings</button>
        </div>
        <p className={`storage-line storage-${storage.state}`}>{storage.label}</p>
      </div>
    </Screen>
  );
}

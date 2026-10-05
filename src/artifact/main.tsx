import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GymQuestDB, setDatabase } from '../db/db';
import { installBackdrop, installFloor } from '../ui/art/render';
import { App } from '../ui/App';
import '../styles.css';
import '../game.css';
import './artifact.css';
import { connectCloud, setupDownloads } from './cloud';

/** Browser storage can be blocked inside an artifact frame; fall back to memory (the cloud copy still persists). */
async function indexedDbWorks(): Promise<boolean> {
  try {
    const probe = new GymQuestDB('gym-quest-probe');
    await probe.open();
    await probe.delete();
    return true;
  } catch {
    return false;
  }
}

async function boot() {
  installBackdrop();
  installFloor();
  const root = createRoot(document.getElementById('root')!);
  root.render(<div className="screen center muted">Loading your quest log…</div>);

  if (!(await indexedDbWorks())) {
    setDatabase(new GymQuestDB('gym-quest', { indexedDB: new IDBFactory(), IDBKeyRange }));
  }
  await Promise.all([connectCloud(), setupDownloads()]);

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();

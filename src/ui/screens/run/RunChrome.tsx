import { useState } from 'react';
import { abandonRun, fleeFight } from '../../../db/quest';
import { updateSettings } from '../../../db/repo';
import type { Meters } from '../../../logic/fatigue';
import type { LoggedSet, Session, Settings } from '../../../types';
import type { Route } from '../../App';
import { Pixel } from '../../art/Pixel';
import { MENU } from '../../art/sprites';
import { MeterGrid } from '../../components/Meters';
import { formatClock, useConfirm, useNow } from '../../hooks';
import { Sheet } from '../../layout/Screen';

export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label="Menu">
      <Pixel sprite={MENU} size={20} />
    </button>
  );
}

export function RunClock({ session, sets }: { session: Session; sets: LoggedSet[] }) {
  const now = useNow(1000);
  const dmg = sets.reduce((s, x) => s + (x.damage ?? 0), 0);
  return (
    <div className="runclock">
      <span className="outlined">{formatClock((now - session.startedAt) / 1000)}</span>
      <small>{dmg} dmg</small>
    </div>
  );
}

/** The run menu: muscles, leave fight, end quest, camp, sound. */
export function RunMenu({ open, onClose, session, settings, meters, go }: {
  open: boolean;
  onClose: () => void;
  session: Session;
  settings: Settings;
  meters?: Meters;
  go: (r: Route) => void;
}) {
  const run = session.run;
  const [view, setView] = useState<'menu' | 'meters'>('menu');
  const [fleeArmed, confirmFlee] = useConfirm();
  const [endArmed, confirmEnd] = useConfirm();
  const f = run?.phase === 'node' ? run.fight : undefined;
  const boss = f?.enemies.find((e) => e.isBoss && e.hp > 0);
  const close = () => {
    setView('menu');
    onClose();
  };
  return (
    <Sheet open={open} title={view === 'meters' ? 'Muscle meters' : 'Quest menu'} onClose={close}>
      {view === 'meters' ? (
        <>
          {meters && <MeterGrid meters={meters} />}
          <p className="small muted">Bars fill with today's sets. Striped = fatigue left from recent workouts. Gold marks the target zone.</p>
          <button className="btn" onClick={() => setView('menu')}>Back</button>
        </>
      ) : (
        <div className="menu-list">
          <button className="btn" onClick={() => setView('meters')}>Muscle meters</button>
          {f && (
            <button
              className={`btn ${fleeArmed ? 'btn-danger' : ''}`}
              onClick={() => confirmFlee(() => { fleeFight(session.id!); close(); })}
            >
              {fleeArmed ? (boss && !boss.armorBroken ? `Tap again: ${boss.name} escapes` : 'Tap again: no rewards') : 'Leave this fight'}
            </button>
          )}
          {run && run.phase !== 'end' && (
            <button className={`btn ${endArmed ? 'btn-danger' : ''}`} onClick={() => confirmEnd(() => { abandonRun(session.id!); close(); })}>
              {endArmed ? 'Tap again to end the quest' : 'End quest here'}
            </button>
          )}
          <button className={`btn ${settings.sound ? '' : 'btn-dim'}`} onClick={() => updateSettings({ sound: !settings.sound })}>
            Sound: {settings.sound ? 'on' : 'off'}
          </button>
          <button className="btn" onClick={() => go({ name: 'home' })}>Back to camp</button>
        </div>
      )}
    </Sheet>
  );
}

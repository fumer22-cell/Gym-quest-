import { useState } from 'react';
import { getExercise } from '../../../data/exercises';
import { setTarget } from '../../../db/quest';
import { finishExercise, setActiveExercise, swapExercise } from '../../../db/repo';
import { lockedBy, type Meters } from '../../../logic/fatigue';
import { areOpposite } from '../../../logic/modifiers';
import type { LoggedSet, Session, Settings } from '../../../types';
import { Hud } from '../../components/Combat';
import { RestCards, RestPill } from '../../components/RestPanel';
import { Hand } from '../../hand/Hand';
import { Screen, TopBar } from '../../layout/Screen';
import { Stage } from '../../scene/Stage';
import { MenuButton, RunClock } from './RunChrome';

export function FightView({ session, settings, sets, meters, mastery, openMenu }: {
  session: Session;
  settings: Settings;
  sets: LoggedSet[];
  meters?: Meters;
  mastery: Record<string, number>;
  openMenu: () => void;
}) {
  const run = session.run!;
  const f = run.fight!;
  const [toast, setToast] = useState<string | null>(null);
  const working = sets.filter((s) => !s.isWarmup);
  const sup = f.superset ? getExercise(f.superset.firstExerciseId) : undefined;
  const boss = f.enemies.find((e) => e.isBoss);
  const lastLog = run.log[run.log.length - 1];

  const swap = async (id: string) => {
    if (!(await swapExercise(session.id!, id))) {
      setToast('No similar exercise left to swap in.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <Screen scene={boss ? 'boss' : run.mode === 'training' ? 'calm' : 'dungeon'} className="fight">
      <TopBar left={<MenuButton onClick={openMenu} />} center={<Hud run={run} event={f.lastEvent} />} right={<RunClock session={session} sets={sets} />} />
      {boss?.nemesisId && <p className="banner banner-nemesis outlined">Your nemesis returns!</p>}
      <Stage
        enemies={f.enemies}
        event={f.lastEvent}
        targetId={f.enemies.length > 1 ? f.targetId : undefined}
        reveal={(f.revealUntilTurn ?? 0) > f.turn}
        unit={settings.unit}
        onSelect={(id) => setTarget(session.id!, id)}
        top={
          <>
            <RestPill session={session} settings={settings} />
            <RestCards session={session} settings={settings} />
            {lastLog && <p className="combat-log" key={lastLog}>{lastLog}</p>}
          </>
        }
      />
      {sup && <p className="banner banner-superset">Superset! Play an opposite-muscle card next. It hits the other enemy.</p>}
      <Hand
        cards={session.hand.map((id) => ({
          id,
          setsDone: working.filter((s) => s.exerciseId === id).length,
          lockedBy: meters ? lockedBy(getExercise(id), meters) : null,
          mastery: mastery[id] ?? 0,
          disrupted: f.disrupted === id,
          highlight: !!sup && id !== sup.id && areOpposite(sup, getExercise(id)),
          runCard: run.runCards.includes(id),
        }))}
        onPlay={(id) => setActiveExercise(session.id!, id)}
        onSwap={swap}
        onDiscard={(id) => finishExercise(session.id!, id)}
        emptyText="No card can hit these enemies right now. Open the menu to leave the fight."
      />
      {toast && <div className="toast">{toast}</div>}
    </Screen>
  );
}

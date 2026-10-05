import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { getExercise } from '../../data/exercises';
import { checkOverrun, ensureRun } from '../../db/quest';
import { allHistoryFor, getMeters, setsForSession } from '../../db/repo';
import { masteryLevel } from '../../logic/mastery';
import { currentIntent, living, restOverdue } from '../../logic/run/combat';
import { nodeById } from '../../logic/run/map';
import type { LoggedSet, Session, Settings } from '../../types';
import type { Route } from '../App';
import { Logger } from '../components/Logger';
import { buzz } from '../feedback';
import { useNow } from '../hooks';
import { Screen } from '../layout/Screen';
import { sfx } from '../sound';
import { FightView } from './run/FightView';
import { MapView } from './run/MapView';
import { CampfireView, RewardView } from './run/NodeViews';
import { RunMenu } from './run/RunChrome';
import { RunEndView } from './run/RunEndView';

export function RunScreen({ session, settings, go }: { session: Session; settings: Settings; go: (r: Route) => void }) {
  const run = session.run;
  const sets = useLiveQuery(() => setsForSession(session.id!), [session.id], [] as LoggedSet[]);
  const meters = useLiveQuery(() => getMeters(session.id!), [session.id]);
  const handKey = [...session.hand, session.activeExerciseId ?? ''].join();
  const mastery = useLiveQuery(
    async () => {
      const ids = [...new Set([...session.hand, ...(session.activeExerciseId ? [session.activeExerciseId] : [])])];
      const levels = await Promise.all(ids.map(async (id) => [id, masteryLevel(getExercise(id), await allHistoryFor(id))] as const));
      return Object.fromEntries(levels) as Record<string, number>;
    },
    [handKey, sets.length],
    {} as Record<string, number>,
  );
  const now = useNow(1000);
  const [menu, setMenu] = useState(false);
  const campEnteredAt = useRef(Date.now());

  useEffect(() => {
    if (!run) ensureRun(session.id!);
  }, [run, session.id]);

  // Attack intents land the moment a rest overruns its window + grace.
  const f = run?.phase === 'node' ? run.fight : undefined;
  useEffect(() => {
    if (!f || !session.restStartedAt || !session.restExerciseId) return;
    if (f.attackResolvedFor === session.restStartedAt) return;
    if (!living(f).some((e) => currentIntent(e).type === 'attack')) return;
    if (!restOverdue(session.restExerciseId, session.restStartedAt, now)) return;
    checkOverrun(session.id!).then((o) => {
      if (o && o.hurt > 0) {
        sfx(settings, 'hurt');
        buzz(settings, [300, 80, 300]);
      }
    });
  }, [f, now, session.id, session.restStartedAt, session.restExerciseId, settings]);

  // Sound for whatever just happened in the fight.
  const lastAt = useRef(f?.lastEvent?.at);
  useEffect(() => {
    const e = f?.lastEvent;
    if (!e || e.at === lastAt.current) return;
    lastAt.current = e.at;
    if (e.kind === 'armor-break') sfx(settings, 'break');
    else if (e.kind === 'defeat') sfx(settings, 'victory');
    else if (e.kind === 'hit') sfx(settings, e.crit ? 'crit' : 'hit');
    else if (e.kind === 'heal' || e.kind === 'shield') sfx(settings, 'heal');
    else if (e.kind === 'escape') sfx(settings, 'defeat');
  }, [f?.lastEvent, settings]);

  useEffect(() => {
    if (run?.phase === 'node' && !run.fight) campEnteredAt.current = Date.now();
  }, [run?.phase, run?.nodeId, run?.fight]);

  if (!run) {
    return (
      <Screen scene="calm">
        <p className="center-fill muted">Preparing your quest…</p>
      </Screen>
    );
  }
  const node = nodeById(run.map, run.nodeId);
  const openMenu = () => setMenu(true);

  let view;
  if (session.activeExerciseId && run.phase !== 'end' && run.phase !== 'reward') {
    view = (
      <Logger
        key={session.activeExerciseId}
        session={session}
        sessionSets={sets}
        meters={meters}
        exerciseId={session.activeExerciseId}
        settings={settings}
        mastery={mastery[session.activeExerciseId] ?? 0}
      />
    );
  } else if (run.phase === 'end') view = <RunEndView session={session} settings={settings} sets={sets} meters={meters} go={go} />;
  else if (run.phase === 'reward' && run.reward) view = <RewardView sessionId={session.id!} run={run} settings={settings} />;
  else if (run.phase === 'node' && run.fight)
    view = <FightView session={session} settings={settings} sets={sets} meters={meters} mastery={mastery} openMenu={openMenu} />;
  else if (run.phase === 'node' && node?.type === 'campfire') view = <CampfireView sessionId={session.id!} run={run} enteredAt={campEnteredAt.current} />;
  else
    view = (
      <MapView
        session={session}
        run={run}
        meters={meters}
        settings={settings}
        sets={sets}
        nemesis={(settings.nemeses ?? []).find((n) => n.id === run.nemesisId)}
        openMenu={openMenu}
      />
    );

  return (
    <>
      <div className="view-fade" key={`${run.phase}-${run.nodeId}-${session.activeExerciseId ?? ''}`}>
        {view}
      </div>
      <RunMenu open={menu} onClose={() => setMenu(false)} session={session} settings={settings} meters={meters} go={go} />
    </>
  );
}

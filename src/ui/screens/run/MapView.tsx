import { useState } from 'react';
import { enterMapNode } from '../../../db/quest';
import type { Meters } from '../../../logic/fatigue';
import { BOSS_FOR_LIFT } from '../../../logic/run/enemies';
import { reachable } from '../../../logic/run/map';
import type { LoggedSet, MapNode, Nemesis, RunState, Session, Settings } from '../../../types';
import { CREATURES } from '../../art/creatures';
import { Pixel } from '../../art/Pixel';
import { CAMPFIRE, HERO, SKULL, SWORD, TREASURE } from '../../art/sprites';
import { Hud } from '../../components/Combat';
import { MeterGrid } from '../../components/Meters';
import { Screen, Sheet, TopBar } from '../../layout/Screen';
import { sfx } from '../../sound';
import { MenuButton, RunClock } from './RunChrome';

const NODE_LABEL: Record<MapNode['type'], string> = {
  fight: 'Fight',
  campfire: 'Campfire',
  treasure: 'Treasure',
  nemesis: 'Nemesis',
  boss: 'Boss',
};

function NodeIcon({ node, run }: { node: MapNode; run: RunState }) {
  switch (node.type) {
    case 'campfire':
      return <Pixel sprite={CAMPFIRE[0]} size={32} />;
    case 'treasure':
      return <Pixel sprite={TREASURE} size={32} />;
    case 'nemesis':
      return <Pixel sprite={SKULL} size={32} recolor={{ w: '#a7f070', r: '#b13e53' }} />;
    case 'boss': {
      const b = BOSS_FOR_LIFT[run.bossLift ?? 'bench'];
      return <Pixel sprite={CREATURES[b.kind]} size={48} recolor={b.recolor} />;
    }
    default:
      return run.mode === 'training' ? <Pixel sprite={CREATURES.dummy} size={30} /> : <Pixel sprite={SWORD} size={28} />;
  }
}

export function MapView({ session, run, meters, settings, sets, nemesis, openMenu }: {
  session: Session;
  run: RunState;
  meters?: Meters;
  settings: Settings;
  sets: LoggedSet[];
  nemesis?: Nemesis;
  openMenu: () => void;
}) {
  const [moving, setMoving] = useState<string | null>(null);
  const [muscles, setMuscles] = useState(false);
  const layers = Math.max(...run.map.map((n) => n.layer)) + 1;
  const width = (l: number) => run.map.filter((n) => n.layer === l).length;
  const open = new Set(reachable(run.map, run.nodeId).map((n) => n.id));
  // Percent positions: layer 0 at the bottom, the boss at the top, with room for the start.
  const rows = layers + 0.6;
  const pos = (n: MapNode) => ({ x: ((n.col + 0.5) / width(n.layer)) * 100, y: ((layers - 1 - n.layer + 0.5) / rows) * 100 });
  const start = { x: 50, y: ((layers + 0.25) / rows) * 100 };
  const visited = new Set(run.visited);
  const here = moving ? pos(run.map.find((n) => n.id === moving)!) : run.nodeId ? pos(run.map.find((n) => n.id === run.nodeId)!) : start;
  const boss = run.bossLift ? BOSS_FOR_LIFT[run.bossLift] : undefined;

  const choose = (n: MapNode) => {
    if (moving) return;
    sfx(settings, 'select');
    setMoving(n.id);
    setTimeout(() => {
      enterMapNode(session.id!, n.id).finally(() => setMoving(null));
    }, 480);
  };

  return (
    <Screen scene="map" torches={false} floor={false} className="map-screen">
      <TopBar left={<MenuButton onClick={openMenu} />} center={<Hud run={run} />} right={<RunClock session={session} sets={sets} />} />
      <div className="map-title">
        <h2 className="outlined">{run.mode === 'training' ? 'Training Grounds' : 'Choose your path'}</h2>
        <p>
          {run.mode === 'training'
            ? 'Practice dummies never hit back. Log normal sets so the game learns you.'
            : nemesis
              ? `${nemesis.name} prowls these halls.`
              : `The ${boss?.name ?? 'boss'} waits at the top.`}
        </p>
      </div>
      <div className="map-area">
        <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {run.map.flatMap((n) =>
            n.next.map((id) => {
              const m = run.map.find((x) => x.id === id)!;
              const a = pos(n);
              const b = pos(m);
              const done = visited.has(n.id) && visited.has(m.id);
              const live = n.id === run.nodeId && open.has(m.id);
              return <line key={`${n.id}-${id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={done ? 'line-done' : live ? 'line-open' : ''} vectorEffect="non-scaling-stroke" />;
            }),
          )}
          {run.nodeId === null &&
            [...open].map((id) => {
              const b = pos(run.map.find((x) => x.id === id)!);
              return <line key={`start-${id}`} x1={start.x} y1={start.y} x2={b.x} y2={b.y} className="line-open" vectorEffect="non-scaling-stroke" />;
            })}
        </svg>
        {run.map.map((n, i) => {
          const p = pos(n);
          const state = n.id === run.nodeId ? 'here' : visited.has(n.id) ? 'done' : open.has(n.id) ? 'open' : 'far';
          return (
            <button
              key={n.id}
              className={`map-node map-${state} node-${n.type}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${(i % 5) * 120}ms` }}
              disabled={!open.has(n.id) || run.phase !== 'map' || !!moving}
              onClick={() => choose(n)}
              aria-label={`${NODE_LABEL[n.type]}${open.has(n.id) ? ', available' : ''}`}
            >
              <NodeIcon node={n} run={run} />
            </button>
          );
        })}
        <span className="map-hero" style={{ left: `${here.x}%`, top: `${here.y}%` }} aria-hidden="true">
          <Pixel sprite={HERO} size={40} className="anim-breathe" />
        </span>
      </div>
      <div className="map-foot">
        <span className="map-legend">
          <span><Pixel sprite={SWORD} size={16} /> Fight</span>
          <span><Pixel sprite={TREASURE} size={16} /> Loot</span>
          <span><Pixel sprite={CAMPFIRE[0]} size={16} /> Rest</span>
        </span>
        <button className="btn btn-small" onClick={() => setMuscles(true)}>
          Muscles
        </button>
      </div>
      <Sheet open={muscles} title="Muscle meters" onClose={() => setMuscles(false)}>
        {meters && <MeterGrid meters={meters} />}
        <p className="small muted">Enemies spawn weak to the muscles that still need sets, so any path trains your whole body.</p>
      </Sheet>
    </Screen>
  );
}

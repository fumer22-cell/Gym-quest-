import { enterMapNode } from '../../../db/quest';
import type { Meters } from '../../../logic/fatigue';
import { BOSS_FOR_LIFT } from '../../../logic/run/enemies';
import { reachable } from '../../../logic/run/map';
import type { MapNode, Nemesis, RunState, Settings } from '../../../types';
import { CREATURES } from '../../art/creatures';
import { Pixel } from '../../art/Pixel';
import { CAMPFIRE, SKULL, SWORD, TREASURE } from '../../art/sprites';
import { MeterGrid } from '../../components/Meters';
import { sfx } from '../../sound';

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
      return <Pixel sprite={CAMPFIRE[0]} size={36} />;
    case 'treasure':
      return <Pixel sprite={TREASURE} size={36} />;
    case 'nemesis':
      return <Pixel sprite={SKULL} size={36} recolor={{ w: '#a7f070', r: '#b13e53' }} />;
    case 'boss': {
      const b = BOSS_FOR_LIFT[run.bossLift ?? 'bench'];
      return <Pixel sprite={CREATURES[b.kind]} size={48} recolor={b.recolor} />;
    }
    default:
      return run.mode === 'training' ? <Pixel sprite={CREATURES.dummy} size={36} /> : <Pixel sprite={SWORD} size={32} />;
  }
}

export function MapView({ sessionId, run, meters, settings, nemesis }: {
  sessionId: number;
  run: RunState;
  meters?: Meters;
  settings: Settings;
  nemesis?: Nemesis;
}) {
  const layers = Math.max(...run.map.map((n) => n.layer)) + 1;
  const width = (l: number) => run.map.filter((n) => n.layer === l).length;
  const open = new Set(reachable(run.map, run.nodeId).map((n) => n.id));
  const rowH = 92;
  const height = layers * rowH;
  const pos = (n: MapNode) => ({ x: ((n.col + 0.5) / width(n.layer)) * 100, y: (layers - 1 - n.layer) * rowH + rowH / 2 });
  const visited = new Set(run.visited);
  const boss = run.bossLift ? BOSS_FOR_LIFT[run.bossLift] : undefined;

  return (
    <>
      <div className="map-head">
        <h2 className="outlined">{run.mode === 'training' ? 'Training Grounds' : 'Choose your path'}</h2>
        <p className="muted">
          {run.mode === 'training'
            ? 'Practice dummies. They never hit back. Log normal sets so the game learns your strength.'
            : `${boss?.name ?? 'A boss'} waits at the top. Every path trains your whole body.`}
        </p>
        {nemesis && <p className="nemesis-line">Your nemesis {nemesis.name} prowls this map.</p>}
      </div>
      <div className="map panel pixel-corners">
        <div className="map-canvas" style={{ height }}>
          <svg className="map-lines" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
            {run.map.flatMap((n) =>
              n.next.map((id) => {
                const m = run.map.find((x) => x.id === id)!;
                const a = pos(n);
                const b = pos(m);
                const done = visited.has(n.id) && visited.has(m.id);
                const live = n.id === run.nodeId && open.has(m.id);
                return (
                  <line
                    key={`${n.id}-${id}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={done ? 'line-done' : live ? 'line-open' : ''}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }),
            )}
          </svg>
          {run.map.map((n) => {
            const p = pos(n);
            const state = n.id === run.nodeId ? 'here' : visited.has(n.id) ? 'done' : open.has(n.id) ? 'open' : 'far';
            return (
              <button
                key={n.id}
                className={`map-node map-${state} node-${n.type}`}
                style={{ left: `${p.x}%`, top: p.y }}
                disabled={!open.has(n.id) || run.phase !== 'map'}
                onClick={() => {
                  sfx(settings, 'select');
                  enterMapNode(sessionId, n.id);
                }}
                aria-label={`${NODE_LABEL[n.type]}${open.has(n.id) ? ', available' : ''}`}
              >
                <NodeIcon node={n} run={run} />
              </button>
            );
          })}
        </div>
        <div className="map-legend">
          <span><Pixel sprite={SWORD} size={18} /> Fight</span>
          <span><Pixel sprite={CAMPFIRE[0]} size={18} /> Campfire</span>
          <span><Pixel sprite={TREASURE} size={18} /> Treasure</span>
          {nemesis && <span><Pixel sprite={SKULL} size={18} recolor={{ w: '#a7f070' }} /> Nemesis</span>}
        </div>
      </div>
      {meters && (
        <>
          <h3 className="section-title">Muscle meters</h3>
          <div className="panel pixel-corners">
            <MeterGrid meters={meters} />
          </div>
        </>
      )}
    </>
  );
}

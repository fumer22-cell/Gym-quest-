import { config } from '../../config';
import type { MapNode, NodeType } from '../../types';
import type { Rng } from '../hand';

function between(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * A branching map like a deck-builder's act: layers of 2–3 nodes, each connected to nearby nodes
 * in the next layer, ending in a single boss. Every path has the same length, so paths differ in
 * order, risk and loot rather than in how much training they ask for.
 */
export function generateMap(rng: Rng, opts: { nemesis?: boolean; length?: number } = {}): MapNode[] {
  const length = opts.length ?? between(rng, config.run.nodes.min, config.run.nodes.max);
  const layers: MapNode[][] = [];
  for (let l = 0; l < length; l++) {
    const width = l === length - 1 ? 1 : between(rng, config.run.paths.min, config.run.paths.max);
    layers.push(
      Array.from({ length: width }, (_, c) => ({ id: `n${l}-${c}`, layer: l, col: c, type: 'fight' as NodeType, next: [] })),
    );
  }

  // Connect each node to the nodes whose horizontal position is closest in the next layer.
  for (let l = 0; l < length - 1; l++) {
    const cur = layers[l];
    const nxt = layers[l + 1];
    const pos = (i: number, w: number) => (i + 0.5) / w;
    for (const n of cur) {
      const x = pos(n.col, cur.length);
      const sorted = [...nxt].sort((a, b) => Math.abs(pos(a.col, nxt.length) - x) - Math.abs(pos(b.col, nxt.length) - x));
      n.next.push(sorted[0].id);
      if (sorted[1] && Math.abs(pos(sorted[1].col, nxt.length) - x) <= 0.34 && rng() < 0.6) n.next.push(sorted[1].id);
    }
    // Every next-layer node needs a way in.
    for (const m of nxt) {
      if (cur.some((n) => n.next.includes(m.id))) continue;
      const x = pos(m.col, nxt.length);
      const closest = [...cur].sort((a, b) => Math.abs(pos(a.col, cur.length) - x) - Math.abs(pos(b.col, cur.length) - x))[0];
      closest.next.push(m.id);
    }
    for (const n of cur) n.next.sort();
  }

  // Node types. First layer: fights. Last layer: boss. The layer before the boss offers a campfire.
  layers[length - 1][0].type = 'boss';
  const preBoss = layers[length - 2];
  preBoss[Math.floor(rng() * preBoss.length)].type = 'campfire';
  const middle = layers.slice(1, length - 2).flat();
  if (middle.length > 0) {
    const treasure = middle[Math.floor(rng() * middle.length)];
    treasure.type = 'treasure';
    if (opts.nemesis) {
      const options = middle.filter((n) => n !== treasure);
      const pick = options.length ? options[Math.floor(rng() * options.length)] : preBoss.find((n) => n.type === 'fight');
      if (pick) pick.type = 'nemesis';
    }
  }
  return layers.flat();
}

/** Training Grounds: a short straight line of practice fights, no boss. */
export function trainingMap(): MapNode[] {
  const n = config.run.trainingFights;
  return Array.from({ length: n }, (_, l) => ({
    id: `t${l}`,
    layer: l,
    col: 0,
    type: 'fight' as NodeType,
    next: l < n - 1 ? [`t${l + 1}`] : [],
  }));
}

export function nodeById(map: MapNode[], id: string | null): MapNode | undefined {
  return id ? map.find((n) => n.id === id) : undefined;
}

/** Nodes the player may step to next. */
export function reachable(map: MapNode[], nodeId: string | null): MapNode[] {
  if (nodeId === null) return map.filter((n) => n.layer === 0);
  const node = nodeById(map, nodeId);
  return node ? node.next.map((id) => nodeById(map, id)!).filter(Boolean) : [];
}

/** Fights left on the shortest remaining route to the end (for spreading muscles across fights). */
export function fightsAhead(map: MapNode[], nodeId: string | null): number {
  const memo = new Map<string, number>();
  const count = (n: MapNode): number => {
    if (memo.has(n.id)) return memo.get(n.id)!;
    const here = n.type === 'fight' || n.type === 'nemesis' ? 1 : 0;
    const nexts = n.next.map((id) => nodeById(map, id)!);
    const best = nexts.length ? Math.min(...nexts.map(count)) : 0;
    memo.set(n.id, here + best);
    return here + best;
  };
  const starts = reachable(map, nodeId);
  return starts.length ? Math.min(...starts.map(count)) : 0;
}

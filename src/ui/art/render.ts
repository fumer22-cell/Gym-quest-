import { PALETTE, type Sprite } from './sprites';

const cache = new Map<string, string>();

/** Rasterize a sprite at an integer scale so it stays crisp however the browser resamples. */
export function spriteUrl(sp: Sprite, scale = 4, recolor: Record<string, string> = {}): string {
  const key = `${sp.rows.join('|')}@${scale}:${JSON.stringify(recolor)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = sp.w * scale;
  canvas.height = sp.h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  sp.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = recolor[ch] ?? PALETTE[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

/** Deterministic PRNG so the dungeon wall looks the same on every load. */
function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tileable dungeon-brick wall, generated once and set as a CSS variable. */
export function installBackdrop() {
  const W = 48;
  const H = 48;
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rng = mulberry(7);
  const base = ['#191626', '#1c1a2b', '#1f1c30'];
  const fleck = '#262338';
  const mortar = '#100e18';
  const brickH = 8;
  const brickW = 16;
  for (let y = 0; y < H; y++) {
    const row = Math.floor(y / brickH);
    const offset = row % 2 ? brickW / 2 : 0;
    for (let x = 0; x < W; x++) {
      const bx = (x + offset) % brickW;
      const by = y % brickH;
      let color: string;
      if (by === 0 || bx === 0) color = mortar;
      else {
        const brick = Math.floor((x + offset) / brickW) + row * 7;
        color = base[brick % base.length];
        if (by === 1 || bx === 1) color = fleck; // top-left bevel catches torchlight
        if (rng() < 0.05) color = fleck;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  document.documentElement.style.setProperty('--backdrop', `url(${canvas.toDataURL()})`);
  document.documentElement.style.setProperty('--backdrop-size', `${W * scale}px`);
}

/** Flagstone floor tile for the battle stage. */
export function installFloor() {
  const W = 32;
  const H = 16;
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rng = mulberry(11);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = (x + (y >= 8 ? 8 : 0)) % 16;
      const sy = y % 8;
      let c = rng() < 0.5 ? '#232034' : '#26233a';
      if (sx === 0 || sy === 0) c = '#14121e';
      else if (sy === 1) c = '#2e2a45';
      else if (rng() < 0.04) c = '#302c48';
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  document.documentElement.style.setProperty('--floor', `url(${canvas.toDataURL()})`);
  document.documentElement.style.setProperty('--floor-size', `${W * scale}px ${H * scale}px`);
}

/**
 * Hand-drawn pixel sprites as text grids. One character = one pixel, '.' = transparent.
 * Every sprite uses the Sweetie 16 palette so the whole game reads as one set.
 */
import type { Muscle } from '../../types';

export const PALETTE: Record<string, string> = {
  k: '#1a1c2c', // outline / near-black
  p: '#5d275d', // plum
  r: '#b13e53', // crimson
  o: '#ef7d57', // orange
  y: '#ffcd75', // gold
  l: '#a7f070', // lime
  g: '#38b764', // green
  t: '#257179', // teal
  n: '#29366f', // navy
  b: '#3b5dc9', // blue
  c: '#41a6f6', // sky
  a: '#73eff7', // aqua
  w: '#f4f4f4', // white
  s: '#94b0c2', // silver
  d: '#566c86', // steel
  e: '#333c57', // slate
};

export interface Sprite {
  w: number;
  h: number;
  rows: string[];
}

function sprite(rows: string[]): Sprite {
  const w = rows[0].length;
  for (const r of rows) if (r.length !== w) throw new Error(`Sprite row width ${r.length} ≠ ${w}: "${r}"`);
  return { w, h: rows.length, rows };
}

/** Left half → full symmetric sprite. */
function mirrored(half: string[]): Sprite {
  return sprite(half.map((r) => r + [...r].reverse().join('')));
}

// ── Muscle icons: each muscle is an armor slot ─────────────────────────────

const breastplate = mirrored([
  '........',
  '..kkk...',
  '.kwsk...',
  '.kssk...',
  '.ksskkkk',
  '.kwsssss',
  'kswwssss',
  'kswsssss',
  'kssssdsr',
  'ksssdssr',
  '.kssssss',
  '.kdsssss',
  '.kdddsss',
  '..kdddss',
  '...kkkkk',
  '........',
]);

const cape = mirrored([
  '........',
  '...kkkkk',
  '..kyyknn',
  '..kyykbb',
  '..kkkbbb',
  '..kcbbbb',
  '..kcbbbn',
  '.kcbbbnb',
  '.kcbbbnb',
  '.kcbbnbb',
  'kcbbbnbb',
  'kcbbnbbb',
  'kcbbnbbb',
  'knbbnbbn',
  'kkkkkkkk',
  '........',
]);

const pauldron = mirrored([
  '........',
  '....kkkk',
  '..kkswww',
  '.ksswwss',
  '.kssssss',
  'kooooooo',
  'kkkkkkkk',
  '.ksssdss',
  '.kssssss',
  '.kdddddd',
  '..kooooo',
  '..kkkkkk',
  '...kssss',
  '...kdddd',
  '....kkkk',
  '........',
]);

const flexedArm = sprite([
  '................',
  '................',
  '..........kkk...',
  '.........kwyyk..',
  '.........kyyyk..',
  '..........kyok..',
  '..........kyok..',
  '....kkkk..kyok..',
  '...kyyyyk.kyok..',
  '..kyyyyyykyyok..',
  '.kyyyyyyyyyyok..',
  '.kyyyyyyyyyook..',
  '.kooooooooook...',
  '..kkkkkkkkkkk...',
  '................',
  '................',
]);

const hammer = mirrored([
  '........',
  '.kkkkkkk',
  'kswwwwww',
  'ksssssss',
  'ksssssss',
  'kddddddd',
  '.kkkkkkk',
  '......ko',
  '......ko',
  '......ko',
  '......ko',
  '.....kyy',
  '......ko',
  '......ko',
  '.....kkk',
  '........',
]);

const boot = sprite([
  '................',
  '...kkkkkkk......',
  '...kyyyyyk......',
  '...kkkkkkk......',
  '....kwssdk......',
  '....kwssdk......',
  '....kwssdk......',
  '...kkkkkkkk.....',
  '....kwssdk......',
  '....kwssdkk.....',
  '....kwsssdkkk...',
  '...kwsssssswsk..',
  '...ksssssssssk..',
  '...kdddddddddk..',
  '...kkkkkkkkkkk..',
  '................',
]);

const bow = sprite([
  '.........kk.....',
  '........kogk....',
  '.......kok.w....',
  '......kok..w....',
  '.....kok...w....',
  '.....kok...w....',
  '....kok....w....',
  '....kyyk...w....',
  '....kyyk...w....',
  '....kok....w....',
  '.....kok...w....',
  '.....kok...w....',
  '......kok..w....',
  '.......kok.w....',
  '........kogk....',
  '.........kk.....',
]);

const belt = mirrored([
  '........',
  '........',
  '........',
  '........',
  'kkkkkkkk',
  'krrrrkkk',
  'kpppykyy',
  'kppppkyk',
  'kppppkyk',
  'kpppykyy',
  'krrrrkkk',
  'kkkkkkkk',
  '........',
  '........',
  '........',
  '........',
]);

export const MUSCLE_SPRITES: Record<Muscle, Sprite> = {
  chest: breastplate,
  back: cape,
  shoulders: pauldron,
  biceps: flexedArm,
  triceps: hammer,
  quads: boot,
  hamstrings_glutes: bow,
  core: belt,
};

// ── UI icons ───────────────────────────────────────────────────────────────

export const LOCK = mirrored([
  '........',
  '........',
  '....kkkk',
  '...kdsss',
  '...kdk..',
  '...kdk..',
  '..kkkkkk',
  '..kyyyyy',
  '..kyoooo',
  '..kyoook',
  '..kyoook',
  '..kyoooo',
  '..kooooo',
  '..kkkkkk',
  '........',
  '........',
]);

export const CROWN = mirrored([
  '........',
  '........',
  '........',
  '.k.....k',
  'kyk...ky',
  'kyyk.kyy',
  'kyyykyyy',
  'kyyyyyyy',
  'kyyryyyc',
  'kyyyyyyy',
  'kooooooo',
  'kkkkkkkk',
  '........',
  '........',
  '........',
  '........',
]);

export const SWORD = sprite([
  '............kkk.',
  '...........kwsk.',
  '..........kwsk..',
  '.........kwsk...',
  '........kwsk....',
  '.......kwsk.....',
  '..kk..kwsk......',
  '..kyykwsk.......',
  '...kyyyk........',
  '...kokyyk.......',
  '..koko.kyk......',
  '.koko...kk......',
  'kyko............',
  'kkk.............',
  '................',
  '................',
]);

const LOGS = ['..kkkk....kkkk..', '.kooppkkkkppook.', '.kkkkkkkkkkkkkk.', '................'];

export const CAMPFIRE: Sprite[] = [
  [
    '................', '................', '................',
    '........r.......',
    '.......rr.......',
    '......ror..r....',
    '.....roor.ror...',
    '.....royorroor..',
    '....royyyoroyor.',
    '....royyyyyyyor.',
    '....roywwwwyyor.',
    '.....rowwwwyor..',
  ],
  [
    '................', '................', '................',
    '..........r.....',
    '.......r..rr....',
    '.......rr.ror...',
    '......rorrror...',
    '.....roorooor...',
    '....royyooyyor..',
    '....royyyyyyyor.',
    '....roywwwyyyor.',
    '.....rowwwwyor..',
  ],
  [
    '................', '................', '................',
    '......r.........',
    '......rr...r....',
    '.....ror..rr....',
    '.....roor.ror...',
    '....rooyoroyor..',
    '....royyyoyyor..',
    '....royyyyyyyor.',
    '....roywwwwyyor.',
    '.....rowwwwyor..',
  ],
].map((flame) => sprite([...flame, ...LOGS]));

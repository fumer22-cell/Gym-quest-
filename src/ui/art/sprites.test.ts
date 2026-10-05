import { describe, expect, it } from 'vitest';
import { MUSCLES } from '../../types';
import { CREATURES } from './creatures';
import * as ALL from './sprites';
import { CAMPFIRE, CROWN, LOCK, MUSCLE_SPRITES, PALETTE, SWORD } from './sprites';

describe('sprites', () => {
  const icons = Object.fromEntries(Object.entries(ALL).filter(([, v]) => v && typeof v === 'object' && 'rows' in (v as object)));
  const all = { ...MUSCLE_SPRITES, ...CREATURES, ...icons, LOCK, CROWN, SWORD, ...Object.fromEntries(CAMPFIRE.map((s, i) => [`fire${i}`, s])) };

  it('every muscle has a 16×16 icon', () => {
    for (const m of MUSCLES) expect([MUSCLE_SPRITES[m].w, MUSCLE_SPRITES[m].h], m).toEqual([16, 16]);
  });

  it('only uses palette colors', () => {
    for (const [name, sp] of Object.entries(all)) {
      for (const row of sp.rows) for (const ch of row) expect(ch === '.' || ch in PALETTE, `${name}: "${ch}"`).toBe(true);
    }
  });
});

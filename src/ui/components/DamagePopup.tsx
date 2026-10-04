import { Pixel } from '../art/Pixel';
import { CROWN } from '../art/sprites';

export interface Hit {
  key: number;
  damage: number;
  isPR: boolean;
  junk: boolean;
}

/** A pixel damage number that pops and floats away. Remount (new key) to replay. */
export function DamagePopup({ hit }: { hit: Hit }) {
  return (
    <div className={`hit ${hit.isPR && !hit.junk ? 'hit-crit' : ''}`} aria-live="polite">
      {hit.isPR && (
        <span className="hit-label outlined">
          <Pixel sprite={CROWN} size={24} /> {hit.junk ? 'PR!' : 'PR! CRIT ×2'}
        </span>
      )}
      <span className="hit-num outlined">{hit.junk ? 'Junk' : hit.damage}</span>
    </div>
  );
}

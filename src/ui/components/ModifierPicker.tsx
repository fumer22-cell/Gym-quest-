import { config } from '../../config';
import { MODIFIER_INFO, MODIFIER_ORDER } from '../../logic/modifiers';
import type { Exercise, ModifierId } from '../../types';
import { Pixel } from '../art/Pixel';
import { BOLT, MOD_AMRAP, MOD_DROPSET, MOD_PAUSED, MOD_SUPERSET, type Sprite } from '../art/sprites';

export const MOD_ICON: Record<ModifierId, Sprite> = {
  superset: MOD_SUPERSET,
  dropset: MOD_DROPSET,
  paused: MOD_PAUSED,
  amrap: MOD_AMRAP,
};

/**
 * Modifiers this card may use. Blocked combinations (safety whitelist) are never shown;
 * locked ones show when they unlock.
 */
export function ModifierPicker({
  ex,
  unlocked,
  progress,
  charges,
  value,
  onChange,
}: {
  ex: Exercise;
  unlocked: ModifierId[];
  progress: number;
  charges: number;
  value: ModifierId | undefined;
  onChange: (m: ModifierId | undefined) => void;
}) {
  const allowed = MODIFIER_ORDER.filter((m) => ex.allowedModifiers.includes(m));
  if (allowed.length === 0) return null;
  const selected = value ? MODIFIER_INFO[value] : undefined;
  return (
    <div className="mods panel pixel-corners">
      <div className="mods-head">
        <span className="forecast-label">Modifier</span>
        <span className="mods-charges">
          <Pixel sprite={BOLT} size={18} /> {charges} charge{charges === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mods-row">
        {allowed.map((m) => {
          const open = unlocked.includes(m);
          return (
            <button
              key={m}
              className={`mod pixel-corners ${value === m ? 'mod-on' : ''}`}
              disabled={!open || (charges <= 0 && value !== m)}
              onClick={() => onChange(value === m ? undefined : m)}
              aria-pressed={value === m}
              title={open ? `${MODIFIER_INFO[m].effect} ${MODIFIER_INFO[m].cost}` : `Unlocks at ${config.modifiers.unlocks[m]} progress`}
            >
              <Pixel sprite={MOD_ICON[m]} size={22} />
              <span>{MODIFIER_INFO[m].name}</span>
              {!open && <small>{config.modifiers.unlocks[m] - progress} to unlock</small>}
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="mods-desc">
          {selected.effect} <span className="muted">{selected.cost}</span>
        </p>
      )}
    </div>
  );
}

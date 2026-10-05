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
 * Modifiers this card may use, in one compact row. Blocked combinations (safety whitelist)
 * are never shown; locked ones show how far they are from unlocking.
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
  return (
    <div className="mods">
      <span className="mods-charges" title="Modifier charges">
        <Pixel sprite={BOLT} size={16} />
        {charges}
      </span>
      {allowed.map((m) => {
        const open = unlocked.includes(m);
        return (
          <button
            key={m}
            className={`mod ${value === m ? 'mod-on' : ''}`}
            disabled={!open || (charges <= 0 && value !== m)}
            onClick={() => onChange(value === m ? undefined : m)}
            aria-pressed={value === m}
            title={open ? `${MODIFIER_INFO[m].effect} ${MODIFIER_INFO[m].cost}` : `Unlocks at ${config.modifiers.unlocks[m]} progress`}
          >
            <Pixel sprite={MOD_ICON[m]} size={18} />
            <span>{open ? MODIFIER_INFO[m].name : `${config.modifiers.unlocks[m] - progress} more`}</span>
          </button>
        );
      })}
    </div>
  );
}

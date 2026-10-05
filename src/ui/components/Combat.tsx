import { useEffect, useRef, useState } from 'react';
import type { CombatEvent, RunState } from '../../types';
import { Pixel } from '../art/Pixel';
import { BOLT, HEART, SHIELD } from '../art/sprites';
import { HpBar } from '../scene/Stage';

/** HP, shield and modifier charges, compact enough for the top bar. */
export function Hud({ run, event }: { run: RunState; event?: CombatEvent }) {
  const [hurt, setHurt] = useState(false);
  const seen = useRef(event?.at);
  useEffect(() => {
    if (!event || event.at === seen.current) return;
    seen.current = event.at;
    if (event.kind !== 'hurt' || !event.amount) return;
    setHurt(true);
    const t = setTimeout(() => setHurt(false), 600);
    return () => clearTimeout(t);
  }, [event]);
  return (
    <div className={`hud ${hurt ? 'hud-hurt' : ''}`}>
      <Pixel sprite={HEART} size={22} className="hud-heart" />
      <HpBar hp={run.hp} max={run.maxHp} kind="player" />
      <span className="hud-stat" title="Shield">
        <Pixel sprite={SHIELD} size={18} />
        {run.block}
      </span>
      <span className="hud-stat" title="Modifier charges">
        <Pixel sprite={BOLT} size={18} />
        {run.charges}
      </span>
    </div>
  );
}

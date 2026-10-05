import { useEffect, useRef, useState } from 'react';
import { config } from '../../config';
import { MUSCLE_INFO } from '../../data/muscles';
import { fromKg } from '../../logic/units';
import type { CombatEvent, Enemy, Intent, RunState, Settings } from '../../types';
import { CREATURES } from '../art/creatures';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { BOLT, HEART, PLUS, SHIELD, SWIRL, SWORD } from '../art/sprites';
import { BOSS_FOR_LIFT } from '../../logic/run/enemies';
import { compoundFor } from '../../logic/readiness';
import { muscleStyle } from './ExerciseCard';

const SILVER = { c: '#94b0c2', a: '#f4f4f4', b: '#566c86' };
const SWIRL_COLOR = { p: '#c06fd8' };

export function IntentIcon({ intent, size = 24 }: { intent: Intent; size?: number }) {
  switch (intent.type) {
    case 'attack':
      return <Pixel sprite={SWORD} size={size} />;
    case 'armor':
      return <Pixel sprite={SHIELD} size={size} recolor={SILVER} />;
    case 'disrupt':
      return <Pixel sprite={SWIRL} size={size} recolor={SWIRL_COLOR} />;
    case 'regen':
      return <Pixel sprite={PLUS} size={size} />;
    default:
      return <span className="intent-idle">…</span>;
  }
}

export function intentText(intent: Intent, restLimit?: string): string {
  switch (intent.type) {
    case 'attack':
      return restLimit ? `Attacks for ${intent.value} if you rest past ${restLimit}` : `Attacks for ${intent.value} if you rest too long`;
    case 'armor':
      return `Armor: unmodified cards deal ${intent.value}% less`;
    case 'disrupt':
      return 'Disrupt: locks a card in your hand';
    case 'regen':
      return `Regenerates ${intent.value} after your next set`;
    default:
      return 'Waiting';
  }
}

function IntentBadge({ intent }: { intent: Intent }) {
  return (
    <span className={`intent intent-${intent.type}`}>
      <IntentIcon intent={intent} size={22} />
      {intent.type === 'attack' || intent.type === 'regen' ? <b className="outlined">{intent.value}</b> : null}
    </span>
  );
}

export function HpBar({ hp, max, kind = 'enemy' }: { hp: number; max: number; kind?: 'enemy' | 'player' }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className={`hpbar hpbar-${kind}`} role="meter" aria-valuenow={hp} aria-valuemax={max} aria-label="HP">
      <span className="hpbar-fill" style={{ width: `${pct}%` }} />
      <span className="hpbar-text outlined">
        {Math.max(0, Math.round(hp))}/{max}
      </span>
    </div>
  );
}

/** Replays an animation class whenever `key` changes. */
function useFlash(key: number | undefined, ms = 500): boolean {
  const [on, setOn] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!key) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return on;
}

export function EnemyCard({
  enemy,
  selected,
  reveal,
  event,
  compact,
  unit,
  onSelect,
}: {
  enemy: Enemy;
  selected: boolean;
  reveal: boolean;
  event?: CombatEvent;
  compact?: boolean;
  unit: Settings['unit'];
  onSelect?: () => void;
}) {
  const dead = enemy.hp <= 0;
  const mine = event && event.enemyId === enemy.id ? event : undefined;
  const flash = useFlash(mine?.at);
  const sprite = CREATURES[enemy.kind];
  const recolor = enemy.isBoss && enemy.weakPoint ? BOSS_FOR_LIFT[enemy.weakPoint.lift].recolor : undefined;
  const size = compact ? (enemy.isBoss ? 72 : 60) : enemy.isBoss ? 144 : 100;
  const wp = enemy.weakPoint;
  return (
    <button
      className={`enemy ${selected ? 'enemy-selected' : ''} ${dead ? 'enemy-dead' : ''} ${compact ? 'enemy-compact' : ''}`}
      onClick={onSelect}
      disabled={dead || !onSelect}
      aria-label={`${enemy.name}, ${enemy.hp} HP${selected ? ', targeted' : ''}`}
    >
      {!dead && (
        <span className="enemy-intents">
          <IntentBadge intent={enemy.intents[0]} />
          {reveal && enemy.intents.slice(1, 1 + config.restCards.readIntentTurns).map((i, k) => (
            <span key={k} className="intent-next"><IntentIcon intent={i} size={16} /></span>
          ))}
        </span>
      )}
      <span className={`enemy-sprite ${flash ? (mine?.kind === 'armor-break' || mine?.crit ? 'shake-big flash' : 'shake flash') : ''}`}>
        <Pixel sprite={sprite} size={size} recolor={recolor} />
        {flash && mine?.amount !== undefined && mine.kind !== 'regen' && (
          <span className={`enemy-hit outlined ${mine.crit ? 'enemy-hit-crit' : ''}`}>
            {mine.kind === 'armor-break' ? 'SHATTER!' : mine.amount}
          </span>
        )}
      </span>
      <span className="enemy-name">{enemy.name}</span>
      <HpBar hp={enemy.hp} max={enemy.maxHp} />
      {!compact && (
        <span className="enemy-weak">
          Weak to
          {enemy.weakness.map((m) => (
            <span key={m} className="enemy-weak-chip" style={muscleStyle(m)}>
              <MuscleIcon muscle={m} size={18} /> {MUSCLE_INFO[m].short}
            </span>
          ))}
        </span>
      )}
      {wp && !compact && (
        <span className={`weakpoint ${enemy.armorBroken ? 'weakpoint-broken' : ''}`}>
          {enemy.armorBroken ? (
            'Armor broken!'
          ) : (
            <>
              Weak point: {compoundFor(wp.lift).name} {fromKg(wp.targetWeightKg, unit)} × {wp.targetReps}
              <small>
                {wp.calibration && wp.predictedE1rm === null
                  ? 'Calibration: any solid set breaks it'
                  : `Breaks at ${fromKg(wp.targetWeightKg, unit)} × ${config.boss.minReps}+ · others deal 25%`}
              </small>
            </>
          )}
        </span>
      )}
    </button>
  );
}

/** HP, shield and modifier charges for the run. */
export function Hud({ run, event }: { run: RunState; event?: CombatEvent }) {
  const hurt = useFlash(event?.kind === 'hurt' ? event.at : undefined, 600);
  return (
    <div className={`hud panel pixel-corners ${hurt ? 'hud-hurt shake' : ''}`}>
      <span className="hud-hp">
        <Pixel sprite={HEART} size={28} />
        <HpBar hp={run.hp} max={run.maxHp} kind="player" />
      </span>
      <span className="hud-stat" title="Shield">
        <Pixel sprite={SHIELD} size={24} />
        <b>{run.block}</b>
      </span>
      <span className="hud-stat" title="Modifier charges">
        <Pixel sprite={BOLT} size={24} />
        <b>{run.charges}</b>
      </span>
    </div>
  );
}

export { SILVER };

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { config } from '../../config';
import { MUSCLE_INFO } from '../../data/muscles';
import { compoundFor } from '../../logic/readiness';
import { BOSS_FOR_LIFT } from '../../logic/run/enemies';
import { fromKg } from '../../logic/units';
import type { CombatEvent, Enemy, Intent, Unit } from '../../types';
import { CREATURES } from '../art/creatures';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { HERO, PLUS, SHIELD, SLASH, SWIRL, SWORD } from '../art/sprites';

const FLOATERS = new Set(['harpy', 'wraith']);
const SILVER = { c: '#94b0c2', a: '#f4f4f4', b: '#566c86' };

export function IntentIcon({ intent, size }: { intent: Intent; size: number }) {
  switch (intent.type) {
    case 'attack':
      return <Pixel sprite={SWORD} size={size} />;
    case 'armor':
      return <Pixel sprite={SHIELD} size={size} recolor={SILVER} />;
    case 'disrupt':
      return <Pixel sprite={SWIRL} size={size} recolor={{ p: '#c06fd8' }} />;
    case 'regen':
      return <Pixel sprite={PLUS} size={size} />;
    default:
      return <span className="intent-idle">zz</span>;
  }
}

export function intentText(intent: Intent): string {
  switch (intent.type) {
    case 'attack':
      return `Attacks for ${intent.value} if your rest runs long`;
    case 'armor':
      return `Armor: unmodified cards deal ${intent.value}% less`;
    case 'disrupt':
      return 'Disrupt: locks one of your cards';
    case 'regen':
      return `Heals ${intent.value} after your next set`;
    default:
      return 'Waiting';
  }
}

/** HP bar with a trailing "damage taken" segment that drains after the hit. */
export function HpBar({ hp, max, kind = 'enemy', label = true }: { hp: number; max: number; kind?: 'enemy' | 'player'; label?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className={`hpbar hpbar-${kind}`} role="meter" aria-valuenow={Math.round(hp)} aria-valuemin={0} aria-valuemax={max} aria-label="HP">
      <span className="hpbar-lag" style={{ width: `${pct}%` }} />
      <span className="hpbar-fill" style={{ width: `${pct}%` }} />
      {label && (
        <span className="hpbar-text outlined">
          {Math.max(0, Math.round(hp))}/{max}
        </span>
      )}
    </div>
  );
}

interface Fx {
  at: number;
  kind: CombatEvent['kind'];
  enemyId?: string;
  amount?: number;
  crit?: boolean;
}

/** Plays a short-lived effect for each new combat event. */
function useFx(event: CombatEvent | undefined): Fx | null {
  const [fx, setFx] = useState<Fx | null>(null);
  const seen = useRef(event?.at);
  useEffect(() => {
    if (!event || event.at === seen.current) return;
    seen.current = event.at;
    setFx({ at: event.at, kind: event.kind, enemyId: event.enemyId, amount: event.amount, crit: event.crit });
    const t = setTimeout(() => setFx(null), 1100);
    return () => clearTimeout(t);
  }, [event]);
  return fx;
}

function EnemyFigure({
  enemy,
  fx,
  targeted,
  compact,
  reveal,
  scale,
  onSelect,
}: {
  enemy: Enemy;
  fx: Fx | null;
  targeted: boolean;
  compact: boolean;
  reveal: boolean;
  scale: number;
  onSelect?: () => void;
}) {
  const dead = enemy.hp <= 0;
  const intent = enemy.intents[0];
  const mine = fx && (fx.enemyId === enemy.id || (fx.kind === 'hurt' && intent?.type === 'attack')) ? fx : null;
  const hurt = mine && (mine.kind === 'hit' || mine.kind === 'armor-break' || mine.kind === 'counter');
  const lunge = mine && mine.kind === 'hurt';
  const glow = mine && mine.kind === 'regen';
  const b = enemy.isBoss && enemy.weakPoint ? BOSS_FOR_LIFT[enemy.weakPoint.lift] : undefined;
  const motion = dead ? '' : enemy.isBoss ? 'anim-breathe-slow' : FLOATERS.has(enemy.kind) ? 'anim-float' : 'anim-breathe';
  return (
    <button
      className={`foe ${enemy.isBoss ? 'foe-boss' : ''} ${dead ? 'foe-dead' : ''} ${targeted ? 'foe-targeted' : ''}`}
      style={{ ['--foe-scale' as string]: scale }}
      onClick={onSelect}
      disabled={dead || !onSelect}
      aria-label={`${enemy.name}, ${Math.round(enemy.hp)} of ${enemy.maxHp} HP. ${intent ? intentText(intent) : ''}`}
    >
      {!dead && intent && (
        <span className={`foe-intent intent-${intent.type}`} title={intentText(intent)}>
          <IntentIcon intent={intent} size={compact ? 16 : 20} />
          {(intent.type === 'attack' || intent.type === 'regen') && <b className="outlined">{intent.value}</b>}
          {reveal &&
            enemy.intents.slice(1, 1 + config.restCards.readIntentTurns).map((i, k) => (
              <span key={k} className="foe-intent-next">
                <IntentIcon intent={i} size={12} />
              </span>
            ))}
        </span>
      )}
      {targeted && !dead && <span className="foe-arrow" aria-hidden="true" />}
      <span className="foe-body">
        <span className="foe-shadow" />
        <span
          key={mine?.at ?? 'idle'}
          className={`foe-sprite ${motion} ${intent?.type === 'attack' && !dead ? 'menacing' : ''} ${hurt ? (mine?.crit ? 'fx-hurt-big' : 'fx-hurt') : ''} ${lunge ? 'fx-lunge' : ''} ${glow ? 'fx-glow' : ''}`}
        >
          <Pixel sprite={CREATURES[enemy.kind]} size={CREATURES[enemy.kind].w * 6} recolor={b?.recolor} />
        </span>
        {hurt && <Pixel key={`s${mine!.at}`} sprite={SLASH} size={64} className={`fx-slash ${mine!.crit ? 'fx-slash-crit' : ''}`} />}
        {mine && mine.amount !== undefined && mine.kind !== 'hurt' && (
          <span key={`n${mine.at}`} className={`fx-num outlined ${mine.crit ? 'fx-num-crit' : ''} ${mine.kind === 'regen' ? 'fx-num-heal' : ''}`}>
            {mine.kind === 'armor-break' ? 'SHATTER!' : mine.kind === 'regen' ? `+${mine.amount}` : mine.amount}
          </span>
        )}
      </span>
      <span className="foe-info">
        {!compact && <span className="foe-name">{enemy.name}</span>}
        <HpBar hp={enemy.hp} max={enemy.maxHp} label={!compact} />
        {!compact && (
          <span className="foe-weak">
            {enemy.weakness.map((m) => (
              <span key={m} className="foe-weak-chip" style={{ ['--muscle' as string]: MUSCLE_INFO[m].color }}>
                <MuscleIcon muscle={m} size={14} />
                {MUSCLE_INFO[m].short}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * The battle stage: the hero on the left, enemies on the right, all standing on the dungeon
 * floor. Every combat event animates here (slash, hurt, lunge, numbers, shake).
 */
export function Stage({
  enemies,
  event,
  targetId,
  reveal,
  compact = false,
  unit,
  onSelect,
  top,
  bottom,
}: {
  enemies: Enemy[];
  event?: CombatEvent;
  targetId?: string;
  reveal: boolean;
  compact?: boolean;
  unit: Unit;
  onSelect?: (id: string) => void;
  top?: ReactNode;
  bottom?: ReactNode;
}) {
  const fx = useFx(event);
  const heroStrike = fx && (fx.kind === 'hit' || fx.kind === 'armor-break');
  const heroHurt = fx && fx.kind === 'hurt' && (fx.amount ?? 0) > 0;
  const heroBuff = fx && (fx.kind === 'heal' || fx.kind === 'shield');
  const shake = fx && (fx.crit || fx.kind === 'armor-break' || heroHurt);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shake || !root.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const big = fx!.kind === 'armor-break' ? 10 : 6;
    root.current.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-big}px,${big / 2}px)` },
        { transform: `translate(${big}px,${-big / 2}px)` },
        { transform: `translate(${-big / 2}px,${-big / 2}px)` },
        { transform: `translate(${big / 2}px,${big / 2}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 380, easing: 'steps(6)' },
    );
  }, [fx?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const boss = enemies.find((e) => e.isBoss);
  const wp = boss?.weakPoint;
  const count = enemies.length;
  const scale = boss ? 1 : count >= 3 ? 0.78 : count === 2 ? 0.9 : 1;

  return (
    <div ref={root} className={`stage ${compact ? 'stage-compact' : ''} ${heroHurt ? 'fx-red-flash' : ''}`}>
      {wp && !compact && (
        <div className={`stage-weakpoint ${boss?.armorBroken ? 'broken' : ''}`}>
          {boss?.armorBroken ? (
            <b>Armor shattered!</b>
          ) : (
            <>
              <b>
                Weak point · {compoundFor(wp.lift).name} {fromKg(wp.targetWeightKg, unit)}×{wp.targetReps}
              </b>
              <small>
                {wp.calibration && wp.predictedE1rm === null
                  ? 'Calibration: any solid set breaks it'
                  : `Breaks at ${fromKg(wp.targetWeightKg, unit)}×${config.boss.minReps}+ · others deal 25%`}
              </small>
            </>
          )}
        </div>
      )}
      <div className="stage-top">{top}</div>
      <div className="stage-ground">
        <div className={`hero ${heroStrike ? 'fx-strike' : ''} ${heroHurt ? 'fx-hero-hurt' : ''} ${heroBuff ? 'fx-glow-blue' : ''}`} key={fx?.at ?? 'hero'}>
          <span className="foe-shadow" />
          <span className="hero-sprite anim-breathe">
            <Pixel sprite={HERO} size={HERO.w * 6} />
          </span>
          {heroHurt && <span className="fx-num fx-num-hurt outlined">-{fx!.amount}</span>}
          {heroBuff && fx!.amount !== undefined && <span className="fx-num fx-num-heal outlined">+{fx!.amount}</span>}
        </div>
        <div className={`foes foes-${count}`}>
          {enemies.map((e) => (
            <EnemyFigure
              key={e.id}
              enemy={e}
              fx={fx}
              targeted={!!targetId && targetId === e.id}
              compact={compact}
              reveal={reveal}
              scale={scale}
              onSelect={onSelect && count > 1 ? () => onSelect(e.id) : undefined}
            />
          ))}
        </div>
      </div>
      {bottom && <div className="stage-bottom">{bottom}</div>}
    </div>
  );
}

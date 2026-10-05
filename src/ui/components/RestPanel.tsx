import { useEffect, useRef } from 'react';
import { config } from '../../config';
import { findExercise } from '../../data/exercises';
import { playRest } from '../../db/quest';
import { stopRest } from '../../db/repo';
import { currentIntent, living, REST_CARD_INFO } from '../../logic/run/combat';
import { restPhase, restWindow, type RestPhase } from '../../logic/rest';
import type { RestCardId, Session, Settings } from '../../types';
import { Pixel } from '../art/Pixel';
import { EYE, FLASK, HEART, PLUS, SHIELD, WIND, type Sprite } from '../art/sprites';
import { buzz } from '../feedback';
import { formatClock, useNow } from '../hooks';
import { sfx } from '../sound';

const ICON: Record<RestCardId, { sprite: Sprite; recolor?: Record<string, string> }> = {
  shield: { sprite: SHIELD },
  heal: { sprite: HEART },
  regen: { sprite: PLUS },
  counter: { sprite: SHIELD, recolor: { c: '#ef7d57', a: '#ffcd75', b: '#b13e53' } },
  read: { sprite: EYE },
  water: { sprite: FLASK },
  breathing: { sprite: WIND },
};

const LABEL: Record<RestPhase, string> = { resting: 'Resting', ready: 'Ready!', late: 'Go now', overdue: 'Overdue' };

/** Compact rest timer: phase, time, window marks and the attack deadline. */
export function RestPill({ session, settings }: { session: Session; settings: Settings }) {
  const now = useNow(250);
  const ex = session.restExerciseId ? findExercise(session.restExerciseId) : undefined;
  const elapsed = session.restStartedAt ? (now - session.restStartedAt) / 1000 : 0;
  const phase = ex ? restPhase(ex, elapsed) : 'resting';
  const last = useRef<RestPhase>(phase);
  useEffect(() => {
    if (last.current === phase) return;
    if (phase === 'ready') {
      buzz(settings, [200, 100, 200]);
      sfx(settings, 'ready');
    }
    if (phase === 'overdue') buzz(settings, [400]);
    last.current = phase;
  }, [phase, settings]);
  if (!session.restStartedAt || !ex) return null;
  const w = restWindow(ex);
  const end = w.max + config.rest.grace;
  const f = session.run?.phase === 'node' ? session.run.fight : undefined;
  const threat = f && f.attackResolvedFor !== session.restStartedAt && living(f).some((e) => currentIntent(e).type === 'attack');
  return (
    <div className={`restpill rest-${phase}`}>
      <span className="restpill-label">{LABEL[phase]}</span>
      <span className="restpill-time outlined">{formatClock(elapsed)}</span>
      <span className="restpill-track">
        <span className="restpill-bar" style={{ width: `${Math.min(100, (elapsed / end) * 100)}%` }} />
        <span className="restpill-mark" style={{ left: `${(w.min / end) * 100}%` }} />
        <span className="restpill-mark" style={{ left: `${(w.max / end) * 100}%` }} />
      </span>
      <span className="restpill-sub">{threat ? `Attack at ${formatClock(end)}` : `Go at ${formatClock(w.min)}`}</span>
      <button className="restpill-close" onClick={() => stopRest(session.id!)} aria-label="Stop rest timer">
        ✕
      </button>
    </div>
  );
}

/** This rest's three rest cards. One may be played per rest; they never touch fatigue. */
export function RestCards({ session, settings }: { session: Session; settings: Settings }) {
  const run = session.run;
  const f = run?.phase === 'node' ? run.fight : undefined;
  const canPlay = !!f && !!session.restStartedAt && f.turn > 0 && f.restCardPlayedFor !== session.restStartedAt && run!.mode !== 'training';
  if (!canPlay) return null;
  return (
    <div className="restcards" key={session.restStartedAt}>
      {f!.restOffer.map((card, i) => {
        const info = REST_CARD_INFO[card];
        const icon = ICON[card];
        return (
          <button
            key={card}
            className={`restcard ${info.action ? 'restcard-real' : ''}`}
            style={{ animationDelay: `${i * 80}ms` }}
            onClick={() => {
              sfx(settings, card === 'shield' || card === 'counter' ? 'select' : 'heal');
              playRest(session.id!, card);
            }}
            title={`${info.text}${info.action ? ` ${info.action}` : ''}`}
          >
            <Pixel sprite={icon.sprite} size={22} recolor={icon.recolor} />
            <b>{info.name}</b>
            <small>{info.text}</small>
          </button>
        );
      })}
    </div>
  );
}

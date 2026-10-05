import { config } from '../../config';
import { findExercise } from '../../data/exercises';
import { playRest } from '../../db/quest';
import { currentIntent, living, REST_CARD_INFO } from '../../logic/run/combat';
import { restWindow } from '../../logic/rest';
import type { RestCardId, Session, Settings } from '../../types';
import { Pixel } from '../art/Pixel';
import { EYE, FLASK, HEART, PLUS, SHIELD, WIND, type Sprite } from '../art/sprites';
import { formatClock } from '../hooks';
import { sfx } from '../sound';
import { RestTimer } from './RestTimer';

const ICON: Record<RestCardId, { sprite: Sprite; recolor?: Record<string, string> }> = {
  shield: { sprite: SHIELD },
  heal: { sprite: HEART },
  regen: { sprite: PLUS },
  counter: { sprite: SHIELD, recolor: { c: '#ef7d57', a: '#ffcd75', b: '#b13e53' } },
  read: { sprite: EYE },
  water: { sprite: FLASK },
  breathing: { sprite: WIND },
};

/** Rest timer plus, inside a fight, this rest's rest cards and the attack warning. */
export function RestPanel({ session, settings }: { session: Session; settings: Settings }) {
  const run = session.run;
  const f = run?.phase === 'node' ? run.fight : undefined;
  const resting = !!session.restStartedAt;
  const ex = session.restExerciseId ? findExercise(session.restExerciseId) : undefined;
  const attackers = f ? living(f).filter((e) => currentIntent(e).type === 'attack') : [];
  const limit = ex ? formatClock(restWindow(ex).max + config.rest.grace) : '';
  const canPlay = !!f && resting && f.turn > 0 && f.restCardPlayedFor !== session.restStartedAt && run!.mode !== 'training';

  return (
    <>
      <RestTimer session={session} settings={settings} />
      {f && resting && attackers.length > 0 && f.attackResolvedFor !== session.restStartedAt && (
        <p className="attack-warning">
          {attackers.map((a) => a.name).join(' & ')} will strike if you rest past {limit}.
        </p>
      )}
      {canPlay && (
        <div className="rest-cards">
          <span className="rest-cards-title">Play one rest card</span>
          <div className="rest-cards-row">
            {f!.restOffer.map((card) => {
              const info = REST_CARD_INFO[card];
              const icon = ICON[card];
              return (
                <button
                  key={card}
                  className={`rest-card pixel-corners ${info.action ? 'rest-card-real' : ''}`}
                  onClick={() => {
                    sfx(settings, card === 'shield' || card === 'counter' ? 'select' : 'heal');
                    playRest(session.id!, card);
                  }}
                >
                  <Pixel sprite={icon.sprite} size={32} recolor={icon.recolor} />
                  <b>{info.name}</b>
                  <small>{info.text}</small>
                  {info.action && <em>{info.action}</em>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

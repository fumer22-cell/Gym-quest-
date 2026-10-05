import { useEffect, useState } from 'react';
import { config } from '../../../config';
import { getExercise } from '../../../data/exercises';
import { claimReward, restAtCamp } from '../../../db/quest';
import type { RunState, Settings } from '../../../types';
import { Campfire, Pixel } from '../../art/Pixel';
import { BOLT, CROWN, HERO } from '../../art/sprites';
import { Hud } from '../../components/Combat';
import { GameCard } from '../../components/ExerciseCard';
import { formatClock, useNow } from '../../hooks';
import { Screen, TopBar } from '../../layout/Screen';
import { sfx } from '../../sound';

export function RewardView({ sessionId, run, settings }: { sessionId: number; run: RunState; settings: Settings }) {
  const r = run.reward!;
  const [pick, setPick] = useState<string | undefined>();
  useEffect(() => {
    sfx(settings, r.nemesisSlain ? 'break' : 'victory');
  }, [settings, r.nemesisSlain]);
  const title = r.treasure ? 'Treasure!' : r.nemesisSlain ? 'Nemesis slain!' : 'Victory!';
  return (
    <Screen scene="victory" floor={false} className="reward-screen">
      <TopBar center={<Hud run={run} />} />
      <div className="reward-head">
        <h1 className="title-banner outlined">{title}</h1>
        {r.nemesisSlain && (
          <p className="reward-note">
            <Pixel sprite={CROWN} size={24} /> Legendary! +2 modifier progress and a bonus charge.
          </p>
        )}
        {!r.treasure && r.charge && (
          <p className="reward-note">
            <Pixel sprite={BOLT} size={20} /> +1 modifier charge
          </p>
        )}
        <p className="muted">{r.treasure ? 'Take a card or a modifier charge.' : 'Choose a card for the rest of this run.'}</p>
      </div>
      <div className="reward-cards">
        {r.cards.map((id, i) => (
          <button
            key={id}
            className={`reward-card ${pick === id ? 'picked' : ''}`}
            style={{ animationDelay: `${i * 120}ms` }}
            onClick={() => {
              sfx(settings, 'select');
              setPick(id);
            }}
            aria-pressed={pick === id}
            aria-label={getExercise(id).name}
          >
            <GameCard card={{ id }} selected={pick === id} />
          </button>
        ))}
      </div>
      <div className="actions">
        <button className="btn btn-primary btn-big" disabled={!pick} onClick={() => claimReward(sessionId, { card: pick })}>
          {pick ? `Take ${getExercise(pick).name}` : 'Pick a card'}
        </button>
        <div className="row">
          {r.treasure && (
            <button className="btn grow" onClick={() => claimReward(sessionId, { charge: true })}>
              <Pixel sprite={BOLT} size={16} className="inline-icon" /> Take a charge
            </button>
          )}
          <button className="btn btn-ghost grow" onClick={() => claimReward(sessionId, {})}>
            Skip
          </button>
        </div>
      </div>
    </Screen>
  );
}

export function CampfireView({ sessionId, run, enteredAt }: { sessionId: number; run: RunState; enteredAt: number }) {
  const now = useNow(1000);
  const heal = Math.round(run.maxHp * config.campfire.healPct);
  return (
    <Screen scene="camp" torches={false} className="camp-screen">
      <TopBar center={<Hud run={run} />} />
      <div className="camp-scene">
        <h1 className="title-banner outlined">Campfire</h1>
        <div className="camp-fire-row">
          <span className="camp-hero anim-breathe">
            <Pixel sprite={HERO} size={96} />
          </span>
          <span className="camp-fire">
            <Campfire size={128} />
          </span>
        </div>
        <p className="camp-time outlined">{formatClock((now - enteredAt) / 1000)}</p>
        <p className="center-text muted">
          A planned longer break: about {config.campfire.suggestedMinutes} minutes. Sip water, walk, loosen up.
        </p>
      </div>
      <div className="actions">
        <button className="btn btn-primary btn-big" onClick={() => restAtCamp(sessionId)}>
          Rest · +{heal} HP
        </button>
      </div>
    </Screen>
  );
}

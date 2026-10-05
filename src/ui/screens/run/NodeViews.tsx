import { useEffect, useState } from 'react';
import { config } from '../../../config';
import { getExercise } from '../../../data/exercises';
import { claimReward, restAtCamp } from '../../../db/quest';
import type { RunState, Settings } from '../../../types';
import { Campfire, Pixel } from '../../art/Pixel';
import { BOLT, CROWN } from '../../art/sprites';
import { Hud } from '../../components/Combat';
import { ExerciseCard } from '../../components/ExerciseCard';
import { formatClock, useNow } from '../../hooks';
import { sfx } from '../../sound';

export function RewardView({ sessionId, run, settings }: { sessionId: number; run: RunState; settings: Settings }) {
  const r = run.reward!;
  const [pick, setPick] = useState<string | undefined>();
  useEffect(() => {
    sfx(settings, r.nemesisSlain ? 'break' : 'victory');
  }, [settings, r.nemesisSlain]);
  const title = r.treasure ? 'Treasure!' : r.nemesisSlain ? 'Nemesis slain!' : 'Victory!';
  return (
    <>
      <Hud run={run} />
      <h1 className="summary-title outlined">{title}</h1>
      {r.nemesisSlain && (
        <p className="center-text nemesis-reward">
          <Pixel sprite={CROWN} size={32} /> A legendary win. +2 modifier unlock progress and an extra charge.
        </p>
      )}
      {!r.treasure && r.charge && (
        <p className="center-text reward-charge">
          <Pixel sprite={BOLT} size={24} /> +1 modifier charge
        </p>
      )}
      <h3 className="section-title">{r.treasure ? 'Take a card or a charge' : 'Choose a card for this run'}</h3>
      <div className="hand">
        {r.cards.map((id) => (
          <ExerciseCard key={id} id={id} setsDone={0} lockedBy={null} highlight={pick === id} onPlay={() => setPick(id)} onDiscard={() => {}} />
        ))}
      </div>
      <p className="hint">{pick ? `${getExercise(pick).name} joins your deck for this run.` : 'Run cards last until the end of this run. You can keep one.'}</p>
      <div className="bottom-actions">
        <button className="btn btn-primary btn-huge pixel-corners" disabled={!pick} onClick={() => claimReward(sessionId, { card: pick })}>
          Take card
        </button>
        {r.treasure && (
          <button className="btn pixel-corners" onClick={() => claimReward(sessionId, { charge: true })}>
            <Pixel sprite={BOLT} size={20} className="inline-icon" /> Take a modifier charge instead
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => claimReward(sessionId, {})}>
          Skip
        </button>
      </div>
    </>
  );
}

export function CampfireView({ sessionId, run, enteredAt }: { sessionId: number; run: RunState; enteredAt: number }) {
  const now = useNow(1000);
  const heal = Math.round(run.maxHp * config.campfire.healPct);
  return (
    <>
      <Hud run={run} />
      <div className="campfire-scene">
        <h1 className="summary-title outlined">Campfire</h1>
        <div className="campfire-wrap">
          <Campfire size={160} />
        </div>
        <p className="center-text">
          A planned longer break. Take about {config.campfire.suggestedMinutes} minutes: sip water, walk around, loosen up.
        </p>
        <p className="clock outlined center-text">{formatClock((now - enteredAt) / 1000)}</p>
      </div>
      <div className="bottom-actions">
        <button className="btn btn-primary btn-huge pixel-corners" onClick={() => restAtCamp(sessionId)}>
          Rest · +{heal} HP
        </button>
      </div>
    </>
  );
}

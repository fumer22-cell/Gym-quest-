import { useState } from 'react';
import { config } from '../../../config';
import { getExercise } from '../../../data/exercises';
import { finishRun } from '../../../db/quest';
import { allInZone, type Meters } from '../../../logic/fatigue';
import { BOSS_FOR_LIFT } from '../../../logic/run/enemies';
import type { LoggedSet, Session, Settings } from '../../../types';
import type { Route } from '../../App';
import { Pixel } from '../../art/Pixel';
import { CROWN, SWORD } from '../../art/sprites';
import { ExerciseCard } from '../../components/ExerciseCard';
import { MeterGrid } from '../../components/Meters';
import { formatClock, useNow } from '../../hooks';

export function bossLine(session: Session, nemesisName?: string): string | null {
  const run = session.run;
  if (!run || run.mode === 'training') return null;
  const boss = run.bossLift ? BOSS_FOR_LIFT[run.bossLift].name : 'the boss';
  const lines: string[] = [];
  if (run.nemesisOutcome === 'defeated') lines.push(`You finally slew ${nemesisName ?? 'your nemesis'}!`);
  if (run.nemesisOutcome === 'escaped') lines.push(`${nemesisName ?? 'Your nemesis'} got away again.`);
  if (run.bossOutcome === 'defeated') lines.push(`You slew the ${boss}.`);
  else if (run.bossOutcome === 'broken') lines.push(`You shattered the ${boss}'s armor. It limped away beaten.`);
  else if (run.bossOutcome === 'escaped') lines.push(`The ${boss} escaped. It will return as your nemesis.`);
  else lines.push(`You never reached the ${boss}.`);
  return lines.join(' ');
}

export function RunEndView({ session, settings, sets, meters, go }: {
  session: Session;
  settings: Settings;
  sets: LoggedSet[];
  meters?: Meters;
  go: (r: Route) => void;
}) {
  const run = session.run!;
  const now = useNow(5000);
  const [keep, setKeep] = useState<string | undefined>();
  const [remove, setRemove] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const working = sets.filter((s) => !s.isWarmup);
  const damage = working.reduce((s, x) => s + (x.damage ?? 0), 0);
  const prs = working.filter((s) => s.isPR).length;
  const zones = meters ? allInZone(meters) : false;
  const full = settings.deck.length >= config.deck.maxSize;
  const keepable = run.runCards.filter((id) => !settings.deck.includes(id));
  const nemesis = (settings.nemeses ?? []).find((n) => n.id === run.nemesisId);
  const cleared = run.mode === 'run' && zones && !!run.bossOutcome;

  const finish = async () => {
    setBusy(true);
    await finishRun(session.id!, { keep, remove: full ? remove : undefined });
    go({ name: 'summary', sessionId: session.id! });
  };

  return (
    <>
      <h1 className="summary-title outlined">
        {run.mode === 'training' ? 'Training complete!' : cleared ? 'Quest cleared!' : 'Quest ended'}
      </h1>
      <p className="center-text">
        {run.mode === 'training'
          ? 'The game now knows your baselines. Your next run is a real quest with a boss.'
          : bossLine(session, nemesis?.name)}
      </p>
      {run.mode === 'run' && (
        <p className={`center-text ${zones ? 'good' : 'muted'}`}>
          {zones ? 'Every muscle reached its target zone.' : 'Some muscles are still below their zone. They will be waiting next time.'}
        </p>
      )}
      <div className="stat-row">
        <div className="stat panel pixel-corners">
          <div className="stat-num dmg"><Pixel sprite={SWORD} size={24} />{damage}</div>
          <div className="stat-label">Damage</div>
        </div>
        <div className="stat panel pixel-corners">
          <div className="stat-num"><Pixel sprite={CROWN} size={24} />{prs}</div>
          <div className="stat-label">PRs</div>
        </div>
        <div className="stat panel pixel-corners">
          <div className="stat-num">{working.length}</div>
          <div className="stat-label">Sets</div>
        </div>
        <div className="stat panel pixel-corners">
          <div className="stat-num">{formatClock((now - session.startedAt) / 1000)}</div>
          <div className="stat-label">Time</div>
        </div>
      </div>
      {meters && (
        <div className="panel pixel-corners">
          <MeterGrid meters={meters} />
        </div>
      )}

      {keepable.length > 0 && (
        <>
          <h3 className="section-title">Keep one card forever</h3>
          <div className="hand">
            {keepable.map((id) => (
              <ExerciseCard key={id} id={id} setsDone={0} lockedBy={null} highlight={keep === id} onPlay={() => setKeep(keep === id ? undefined : id)} onDiscard={() => {}} />
            ))}
          </div>
          {keep && full && (
            <>
              <p className="center-text warn">Your deck is full ({config.deck.maxSize}). Choose a card to give up for {getExercise(keep).name}.</p>
              <div className="swap-list">
                {settings.deck.map((id) => (
                  <button key={id} className={`picker-item pixel-corners ${remove === id ? 'picker-on' : ''}`} onClick={() => setRemove(id)}>
                    {getExercise(id).name}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <div className="bottom-actions">
        <button className="btn btn-primary btn-huge pixel-corners" disabled={busy || (!!keep && full && !remove)} onClick={finish}>
          {keep ? `Keep ${getExercise(keep).name} & finish` : 'Finish quest'}
        </button>
      </div>
    </>
  );
}

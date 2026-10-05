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
import { GameCard } from '../../components/ExerciseCard';
import { MeterGrid } from '../../components/Meters';
import { formatClock } from '../../hooks';
import { Screen, Sheet } from '../../layout/Screen';

export function bossLine(session: Session, nemesisName?: string): string | null {
  const run = session.run;
  if (!run || run.mode === 'training') return null;
  const boss = run.bossLift ? BOSS_FOR_LIFT[run.bossLift].name : 'the boss';
  const lines: string[] = [];
  if (run.nemesisOutcome === 'defeated') lines.push(`You finally slew ${nemesisName ?? 'your nemesis'}!`);
  if (run.nemesisOutcome === 'escaped') lines.push(`${nemesisName ?? 'Your nemesis'} got away again.`);
  if (run.bossOutcome === 'defeated') lines.push(`You slew the ${boss}.`);
  else if (run.bossOutcome === 'broken') lines.push(`You shattered the ${boss}'s armor. It limped away beaten.`);
  else if (run.bossOutcome === 'escaped') lines.push(`The ${boss} escaped.`);
  else lines.push(`You never reached the ${boss}.`);
  return lines.join(' ');
}

export function StatTiles({ sets, startedAt, endedAt }: { sets: LoggedSet[]; startedAt: number; endedAt: number }) {
  const working = sets.filter((s) => !s.isWarmup);
  return (
    <div className="tiles">
      <div className="tile">
        <b className="dmg"><Pixel sprite={SWORD} size={18} />{working.reduce((s, x) => s + (x.damage ?? 0), 0)}</b>
        <small>Damage</small>
      </div>
      <div className="tile">
        <b><Pixel sprite={CROWN} size={18} />{working.filter((s) => s.isPR).length}</b>
        <small>PRs</small>
      </div>
      <div className="tile">
        <b>{working.length}</b>
        <small>Sets</small>
      </div>
      <div className="tile">
        <b>{formatClock((endedAt - startedAt) / 1000)}</b>
        <small>Time</small>
      </div>
    </div>
  );
}

export function RunEndView({ session, settings, sets, meters, go }: {
  session: Session;
  settings: Settings;
  sets: LoggedSet[];
  meters?: Meters;
  go: (r: Route) => void;
}) {
  const run = session.run!;
  const [keep, setKeep] = useState<string | undefined>();
  const [remove, setRemove] = useState<string | undefined>();
  const [swapOpen, setSwapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const zones = meters ? allInZone(meters) : false;
  const full = settings.deck.length >= config.deck.maxSize;
  const keepable = run.runCards.filter((id) => !settings.deck.includes(id));
  const nemesis = (settings.nemeses ?? []).find((n) => n.id === run.nemesisId);
  const cleared = run.mode === 'run' && zones && !!run.bossOutcome;
  const won = run.mode === 'training' || cleared || run.bossOutcome === 'defeated';

  const finish = async () => {
    if (keep && full && !remove) {
      setSwapOpen(true);
      return;
    }
    setBusy(true);
    await finishRun(session.id!, { keep, remove: full ? remove : undefined });
    go({ name: 'summary', sessionId: session.id! });
  };

  return (
    <Screen scene={won ? 'victory' : 'calm'} floor={false} className="end-screen">
      <div className="end-head">
        <h1 className="title-banner outlined">{run.mode === 'training' ? 'Training complete!' : cleared ? 'Quest cleared!' : 'Quest ended'}</h1>
        <p>{run.mode === 'training' ? 'The game knows your baselines now. Next time: a real quest with a boss.' : bossLine(session, nemesis?.name)}</p>
        {run.mode === 'run' && (
          <p className={zones ? 'good' : 'muted'}>{zones ? 'Every muscle reached its zone.' : 'Some muscles are still below their zone.'}</p>
        )}
      </div>
      <StatTiles sets={sets} startedAt={session.startedAt} endedAt={Date.now()} />
      {meters && (
        <div className="panel end-meters">
          <MeterGrid meters={meters} />
        </div>
      )}
      {keepable.length > 0 ? (
        <>
          <p className="section-label">Keep one card forever {full && <span className="muted">(deck full: you'll swap one out)</span>}</p>
          <div className="keep-row">
            {keepable.map((id) => (
              <button key={id} className={`keep-card ${keep === id ? 'picked' : ''}`} onClick={() => setKeep(keep === id ? undefined : id)} aria-pressed={keep === id} aria-label={getExercise(id).name}>
                <GameCard card={{ id }} selected={keep === id} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grow" />
      )}
      <div className="actions">
        <button className="btn btn-primary btn-big" disabled={busy} onClick={finish}>
          {keep ? `Keep ${getExercise(keep).name} & finish` : 'Finish quest'}
        </button>
      </div>
      <Sheet open={swapOpen} title="Deck is full" onClose={() => setSwapOpen(false)}>
        <p className="small">Choose a card to give up for {keep ? getExercise(keep).name : ''}.</p>
        <div className="pick-grid">
          {settings.deck.map((id) => (
            <button key={id} className={`pick ${remove === id ? 'pick-on' : ''}`} onClick={() => setRemove(id)}>
              {getExercise(id).name}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" disabled={!remove} onClick={() => { setSwapOpen(false); void finish(); }}>
          Swap and finish
        </button>
      </Sheet>
    </Screen>
  );
}

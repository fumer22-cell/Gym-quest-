import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { config } from '../../config';
import { EQUIPMENT } from '../../data/equipment';
import { getExercise } from '../../data/exercises';
import { db } from '../../db/db';
import { startSession, updateSettings } from '../../db/repo';
import { isAvailable } from '../../logic/hand';
import type { EquipmentId, Settings } from '../../types';
import type { Route } from '../App';
import { Campfire, MuscleIcon, Pixel } from '../art/Pixel';
import { HERO } from '../art/sprites';
import { Screen } from '../layout/Screen';

/** The six starter slots and the favorites a lifter can pick for each. */
const SLOTS: { title: string; options: string[] }[] = [
  { title: 'Squat', options: ['back_squat', 'front_squat', 'leg_press', 'goblet_squat', 'bulgarian_split_squat'] },
  { title: 'Press', options: ['bench_press', 'dumbbell_bench_press', 'incline_bench_press', 'machine_chest_press', 'push_up'] },
  { title: 'Row', options: ['barbell_row', 'seated_cable_row', 'one_arm_dumbbell_row'] },
  { title: 'Hinge', options: ['romanian_deadlift', 'deadlift', 'hip_thrust', 'kettlebell_swing'] },
  { title: 'Overhead', options: ['overhead_press', 'dumbbell_shoulder_press', 'machine_shoulder_press'] },
  { title: 'Pull', options: ['lat_pulldown', 'pull_up'] },
];

export function OnboardingScreen({ settings, go }: { settings: Settings; go: (r: Route) => void }) {
  const [step, setStep] = useState(0);
  const [equipment, setEquipment] = useState<EquipmentId[]>(settings.equipment);
  const [picks, setPicks] = useState<string[]>(() =>
    SLOTS.map((s, i) => (settings.deck[i] && s.options.includes(settings.deck[i]) ? settings.deck[i] : config.deck.starter[i])),
  );
  const hasHistory = useLiveQuery(async () => (await db.sets.count()) > 0, [], false);

  const options = (slot: number) => SLOTS[slot].options.filter((id) => isAvailable(getExercise(id), equipment));
  const resolved = picks.map((id, i) => (isAvailable(getExercise(id), equipment) ? id : options(i)[0]));
  const cycle = (i: number, dir: number) => {
    const opts = options(i);
    if (!opts.length) return;
    const cur = Math.max(0, opts.indexOf(resolved[i]));
    setPicks(picks.map((p, k) => (k === i ? opts[(cur + dir + opts.length) % opts.length] : p)));
  };

  const finish = async (skipTraining: boolean) => {
    const starter: readonly string[] = config.deck.starter;
    const chosen = resolved.filter(Boolean) as string[];
    const extra = settings.deck.filter((id) => !chosen.includes(id) && !starter.includes(id));
    await updateSettings({
      equipment,
      deck: [...new Set([...chosen, ...extra])].slice(0, config.deck.maxSize),
      onboarded: true,
      ...(skipTraining ? { calibrated: true } : {}),
    });
    await startSession();
    go({ name: 'session' });
  };

  return (
    <Screen scene={step === 0 ? 'camp' : 'calm'} className="onboard">
      <div className="dots" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}
      </div>

      {step === 0 && (
        <>
          <h1 className="title-banner outlined">Welcome, hero</h1>
          <div className="home-camp">
            <span className="home-hero anim-breathe"><Pixel sprite={HERO} size={72} /></span>
            <span className="home-fire"><Campfire size={96} /></span>
          </div>
          <div className="panel onboard-text">
            <p><b>Each gym session is a quest.</b> Pick a path, fight monsters, face a boss.</p>
            <p><b>Exercises are cards.</b> Play one, do the real set, log it in two taps, and it strikes.</p>
            <p><b>Monsters are weak to what you still need to train,</b> so winning means a balanced, progressive workout.</p>
          </div>
          <div className="actions">
            <button className="btn btn-primary btn-big" onClick={() => setStep(1)}>Next</button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="title-banner outlined">Your gym</h1>
          <p className="center-text muted">Mark what your gym has. You'll never be dealt a card you can't do.</p>
          <div className="equip-grid">
            {EQUIPMENT.map((e) => (
              <button
                key={e.id}
                className={`check ${equipment.includes(e.id) ? 'check-on' : ''}`}
                aria-pressed={equipment.includes(e.id)}
                onClick={() => setEquipment(equipment.includes(e.id) ? equipment.filter((x) => x !== e.id) : [...equipment, e.id])}
              >
                {e.label}
              </button>
            ))}
          </div>
          <div className="actions row">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary btn-big grow" onClick={() => setStep(2)}>Next</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="title-banner outlined">Starter deck</h1>
          <p className="center-text muted">Pick a favorite for each slot. You'll win more cards on quests.</p>
          <div className="slots">
            {SLOTS.map((slot, i) => {
              const id = resolved[i];
              const opts = options(i);
              return (
                <div key={slot.title} className="slot">
                  <span className="slot-title">{slot.title}</span>
                  <button className="slot-arrow" onClick={() => cycle(i, -1)} disabled={opts.length < 2} aria-label={`Previous ${slot.title}`}>‹</button>
                  <span className="slot-pick">
                    {id ? (
                      <>
                        <MuscleIcon muscle={getExercise(id).primaryMuscles[0]} size={20} />
                        {getExercise(id).name}
                      </>
                    ) : (
                      <span className="warn">No equipment for this</span>
                    )}
                  </span>
                  <button className="slot-arrow" onClick={() => cycle(i, 1)} disabled={opts.length < 2} aria-label={`Next ${slot.title}`}>›</button>
                </div>
              );
            })}
          </div>
          <div className="actions">
            <button className="btn btn-primary btn-big" onClick={() => finish(false)}>Enter the Training Grounds</button>
            <div className="row">
              <button className="btn btn-ghost grow" onClick={() => setStep(1)}>Back</button>
              {hasHistory && <button className="btn grow" onClick={() => finish(true)}>Skip training</button>}
            </div>
          </div>
        </>
      )}
    </Screen>
  );
}

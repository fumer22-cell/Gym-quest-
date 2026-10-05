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
import { Campfire, MuscleIcon } from '../art/Pixel';

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
  const [picks, setPicks] = useState<string[]>(() => SLOTS.map((s, i) => settings.deck[i] && s.options.includes(settings.deck[i]) ? settings.deck[i] : config.deck.starter[i]));
  const hasHistory = useLiveQuery(async () => (await db.sets.count()) > 0, [], false);

  const options = (slot: number) => SLOTS[slot].options.filter((id) => isAvailable(getExercise(id), equipment));
  const resolved = picks.map((id, i) => (isAvailable(getExercise(id), equipment) ? id : options(i)[0])).filter(Boolean) as string[];

  const finish = async (skipTraining: boolean) => {
    const starter: readonly string[] = config.deck.starter;
    const extra = settings.deck.filter((id) => !resolved.includes(id) && !starter.includes(id));
    await updateSettings({
      equipment,
      deck: [...new Set([...resolved, ...extra])].slice(0, config.deck.maxSize),
      onboarded: true,
      ...(skipTraining ? { calibrated: true } : {}),
    });
    await startSession();
    go({ name: 'session' });
  };

  return (
    <div className="screen">
      <div className="dots" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}
      </div>

      {step === 0 && (
        <div className="onboard-step">
          <h2 className="outlined">Welcome, adventurer</h2>
          <div className="campfire-wrap center-text" style={{ alignSelf: 'center' }}>
            <Campfire size={112} />
          </div>
          <div className="panel pixel-corners">
            <p>Each gym session is one quest. You pick a path on a map, fight monsters, and face a boss at the end.</p>
            <p style={{ marginTop: 10 }}>The game deals your exercises as cards. You never browse a list: play a card, do the real set, log it in two taps, and it strikes.</p>
            <p style={{ marginTop: 10 }}>Monsters are weak to the muscles you still need to train, so winning means a balanced, progressive workout.</p>
          </div>
          <div className="bottom-actions">
            <button className="btn btn-primary btn-huge pixel-corners" onClick={() => setStep(1)}>Next</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="onboard-step">
          <h2 className="outlined">Your gym</h2>
          <p className="center-text muted">Mark what your gym has. You will never be dealt a card you can't do.</p>
          <div className="equipment-grid">
            {EQUIPMENT.map((e) => (
              <button
                key={e.id}
                className={`toggle pixel-corners ${equipment.includes(e.id) ? 'toggle-on' : ''}`}
                aria-pressed={equipment.includes(e.id)}
                onClick={() => setEquipment(equipment.includes(e.id) ? equipment.filter((x) => x !== e.id) : [...equipment, e.id])}
              >
                {e.label}
              </button>
            ))}
          </div>
          <div className="bottom-actions">
            <button className="btn btn-primary btn-huge pixel-corners" onClick={() => setStep(2)}>Next</button>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onboard-step">
          <h2 className="outlined">Starter deck</h2>
          <p className="center-text muted">Pick your favorite for each slot. You can win more cards on every quest.</p>
          {SLOTS.map((slot, i) => {
            const opts = options(i);
            return (
              <div key={slot.title} className="slot">
                <span className="slot-title">{slot.title}</span>
                {opts.length === 0 ? (
                  <span className="small warn">Nothing available for this slot with your equipment.</span>
                ) : (
                  <div className="slot-options">
                    {opts.map((id) => (
                      <button
                        key={id}
                        className={`picker-item pixel-corners ${resolved[i] === id ? 'picker-on' : ''}`}
                        onClick={() => setPicks(picks.map((p, k) => (k === i ? id : p)))}
                      >
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <MuscleIcon muscle={getExercise(id).primaryMuscles[0]} size={20} />
                          {getExercise(id).name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="bottom-actions">
            <button className="btn btn-primary btn-huge pixel-corners" onClick={() => finish(false)}>
              Enter the Training Grounds
            </button>
            {hasHistory && (
              <button className="btn pixel-corners" onClick={() => finish(true)}>
                Skip training: I have logged here before
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

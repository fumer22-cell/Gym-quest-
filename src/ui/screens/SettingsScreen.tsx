import { useRef, useState } from 'react';
import { config } from '../../config';
import { EQUIPMENT } from '../../data/equipment';
import { EXERCISES, getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';
import { exportData, importData, resetAll, updateSettings, type Backup } from '../../db/repo';
import { useStorageInfo } from '../../db/sync';
import { isAvailable } from '../../logic/hand';
import { MUSCLES, type EquipmentId, type Settings } from '../../types';
import type { Route } from '../App';
import { MuscleIcon } from '../art/Pixel';
import { MuscleChips } from '../components/ExerciseCard';
import { useConfirm } from '../hooks';

export function SettingsScreen({ settings, go }: { settings: Settings; go: (r: Route) => void }) {
  const [adding, setAdding] = useState(false);
  const [resetArmed, confirmReset] = useConfirm();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const storage = useStorageInfo();

  const toggleEquipment = (id: EquipmentId) => {
    const has = settings.equipment.includes(id);
    updateSettings({ equipment: has ? settings.equipment.filter((e) => e !== id) : [...settings.equipment, id] });
  };

  const removeCard = (id: string) => {
    if (settings.deck.length <= config.deck.minSize) return;
    updateSettings({ deck: settings.deck.filter((d) => d !== id) });
  };

  const addCard = (id: string) => {
    if (settings.deck.length >= config.deck.maxSize) return;
    updateSettings({ deck: [...settings.deck, id] });
    setAdding(false);
  };

  const doExport = async () => {
    const data = await exportData();
    const filename = `gym-quest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (storage.saveFile) {
      try {
        await storage.saveFile(filename, JSON.stringify(data));
      } catch {
        setMsg('Export cancelled.');
      }
      return;
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (file: File) => {
    try {
      await importData(JSON.parse(await file.text()) as Backup);
      setMsg('Backup restored.');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="screen settings">
      <div className="topbar">
        <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>← Camp</button>
        <div className="topbar-mid"><div className="clock outlined">Settings</div></div>
        <span style={{ width: 64 }} />
      </div>

      <section>
        <h3 className="section-title">Units</h3>
        <div className="segmented">
          {(['lb', 'kg'] as const).map((u) => (
            <button key={u} className={`btn pixel-corners ${settings.unit === u ? 'on' : ''}`} onClick={() => updateSettings({ unit: u })}>
              {u}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="section-title">Feedback</h3>
        <button className={`toggle pixel-corners ${settings.haptics ? 'toggle-on' : ''}`} onClick={() => updateSettings({ haptics: !settings.haptics })} aria-pressed={settings.haptics}>
          Vibration
        </button>
      </section>

      <section>
        <h3 className="section-title">
          Core deck · {settings.deck.length}/{config.deck.maxSize}
        </h3>
        <ul className="deck-list">
          {settings.deck.map((id) => {
            const ex = getExercise(id);
            const ok = isAvailable(ex, settings.equipment);
            return (
              <li key={id} className="deck-item panel pixel-corners">
                <div>
                  <MuscleIcon muscle={ex.primaryMuscles[0]} size={32} />
                  <div>
                  <div className="log-name">{ex.name}</div>
                  <MuscleChips id={id} />
                  {!ok && <div className="small warn">Missing equipment. A similar card is dealt instead.</div>}
                  </div>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => removeCard(id)}
                  disabled={settings.deck.length <= config.deck.minSize}
                  aria-label={`Remove ${ex.name}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
        {!adding && settings.deck.length < config.deck.maxSize && (
          <button className="btn pixel-corners" onClick={() => setAdding(true)}>+ Add a favorite</button>
        )}
        {adding && (
          <div className="picker panel pixel-corners">
            {MUSCLES.map((m) => {
              const options = EXERCISES.filter(
                (e) => e.primaryMuscles[0] === m && !settings.deck.includes(e.id) && isAvailable(e, settings.equipment),
              );
              if (options.length === 0) return null;
              return (
                <div key={m}>
                  <div className="picker-head" style={{ color: MUSCLE_INFO[m].color }}><MuscleIcon muscle={m} size={24} />{MUSCLE_INFO[m].label}</div>
                  {options.map((e) => (
                    <button key={e.id} className="picker-item pixel-corners" onClick={() => addCard(e.id)}>{e.name}</button>
                  ))}
                </div>
              );
            })}
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">Equipment at my gym</h3>
        <div className="equipment-grid">
          {EQUIPMENT.map((e) => (
            <button
              key={e.id}
              className={`toggle pixel-corners ${settings.equipment.includes(e.id) ? 'toggle-on' : ''}`}
              onClick={() => toggleEquipment(e.id)}
              aria-pressed={settings.equipment.includes(e.id)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="section-title">Your data</h3>
        <p className="small muted storage-label">{storage.label}</p>
        <div className="row">
          <button className="btn grow pixel-corners" onClick={doExport}>Export backup</button>
          <button className="btn grow pixel-corners" onClick={() => fileRef.current?.click()}>Import backup</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
        />
        {msg && <p className="small muted">{msg}</p>}
        <button className={`btn btn-ghost ${resetArmed ? 'danger' : ''}`} onClick={() => confirmReset(() => resetAll())}>
          {resetArmed ? 'Tap again to erase everything' : 'Erase all data'}
        </button>
      </section>
    </div>
  );
}

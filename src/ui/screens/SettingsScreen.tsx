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
import { useConfirm } from '../hooks';
import { Screen, Sheet, Tabs, TopBar } from '../layout/Screen';

type Tab = 'general' | 'deck' | 'gym' | 'data';

export function SettingsScreen({ settings, go }: { settings: Settings; go: (r: Route) => void }) {
  const [tab, setTab] = useState<Tab>('general');
  const [adding, setAdding] = useState(false);
  const [resetArmed, confirmReset] = useConfirm();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const storage = useStorageInfo();

  const toggleEquipment = (id: EquipmentId) => {
    const has = settings.equipment.includes(id);
    updateSettings({ equipment: has ? settings.equipment.filter((e) => e !== id) : [...settings.equipment, id] });
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
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
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
    <Screen scene="calm" floor={false} torches={false} className="list-screen">
      <TopBar
        left={<button className="icon-btn" onClick={() => go({ name: 'home' })} aria-label="Back to camp">←</button>}
        center={<h1 className="screen-title outlined">Settings</h1>}
      />
      <Tabs
        tabs={[
          { id: 'general', label: 'General' },
          { id: 'deck', label: `Deck ${settings.deck.length}/${config.deck.maxSize}` },
          { id: 'gym', label: 'Gym' },
          { id: 'data', label: 'Data' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="scroll-area">
        {tab === 'general' && (
          <div className="stack">
            <p className="section-label">Units</p>
            <div className="row">
              {(['lb', 'kg'] as const).map((u) => (
                <button key={u} className={`btn grow ${settings.unit === u ? 'btn-primary' : ''}`} onClick={() => updateSettings({ unit: u })}>
                  {u}
                </button>
              ))}
            </div>
            <p className="section-label">Feedback</p>
            <button className={`check ${settings.sound ? 'check-on' : ''}`} onClick={() => updateSettings({ sound: !settings.sound })} aria-pressed={settings.sound}>
              Sound effects
            </button>
            <button className={`check ${settings.haptics ? 'check-on' : ''}`} onClick={() => updateSettings({ haptics: !settings.haptics })} aria-pressed={settings.haptics}>
              Vibration
            </button>
            <p className="section-label">Setup</p>
            <button className="btn" onClick={() => updateSettings({ onboarded: false }).then(() => go({ name: 'home' }))}>
              Redo onboarding
            </button>
          </div>
        )}
        {tab === 'deck' && (
          <div className="stack">
            {settings.deck.map((id) => {
              const ex = getExercise(id);
              const ok = isAvailable(ex, settings.equipment);
              return (
                <div key={id} className="list-row panel">
                  <MuscleIcon muscle={ex.primaryMuscles[0]} size={24} />
                  <span className="grow">
                    {ex.name}
                    {!ok && <small className="warn"> needs missing equipment</small>}
                  </span>
                  <button
                    className="icon-btn"
                    onClick={() => settings.deck.length > config.deck.minSize && updateSettings({ deck: settings.deck.filter((d) => d !== id) })}
                    disabled={settings.deck.length <= config.deck.minSize}
                    aria-label={`Remove ${ex.name}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {settings.deck.length < config.deck.maxSize && (
              <button className="btn" onClick={() => setAdding(true)}>
                + Add a favorite
              </button>
            )}
          </div>
        )}
        {tab === 'gym' && (
          <div className="equip-grid">
            {EQUIPMENT.map((e) => (
              <button
                key={e.id}
                className={`check ${settings.equipment.includes(e.id) ? 'check-on' : ''}`}
                onClick={() => toggleEquipment(e.id)}
                aria-pressed={settings.equipment.includes(e.id)}
              >
                {e.label}
              </button>
            ))}
          </div>
        )}
        {tab === 'data' && (
          <div className="stack">
            <p className="muted">{storage.label}</p>
            <div className="row">
              <button className="btn grow" onClick={doExport}>Export backup</button>
              <button className="btn grow" onClick={() => fileRef.current?.click()}>Import backup</button>
            </div>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
            {msg && <p className="small muted">{msg}</p>}
            <button className={`btn ${resetArmed ? 'btn-danger' : 'btn-ghost'}`} onClick={() => confirmReset(() => resetAll())}>
              {resetArmed ? 'Tap again to erase everything' : 'Erase all data'}
            </button>
          </div>
        )}
      </div>
      <Sheet open={adding} title="Add a favorite" onClose={() => setAdding(false)}>
        {MUSCLES.map((m) => {
          const options = EXERCISES.filter((e) => e.primaryMuscles[0] === m && !settings.deck.includes(e.id) && isAvailable(e, settings.equipment));
          if (options.length === 0) return null;
          return (
            <div key={m} className="stack">
              <p className="section-label" style={{ color: MUSCLE_INFO[m].color }}>
                {MUSCLE_INFO[m].label}
              </p>
              <div className="pick-grid">
                {options.map((e) => (
                  <button
                    key={e.id}
                    className="pick"
                    onClick={() => {
                      updateSettings({ deck: [...settings.deck, e.id] });
                      setAdding(false);
                    }}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Sheet>
    </Screen>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Screen, Tabs, TopBar } from '../layout/Screen';
import { config } from '../../config';
import { getExercise } from '../../data/exercises';
import { db } from '../../db/db';
import { compoundFor } from '../../logic/readiness';
import { masteryLevel, masteryTier } from '../../logic/mastery';
import { MODIFIER_INFO, MODIFIER_ORDER, unlockedModifiers } from '../../logic/modifiers';
import { BOSS_FOR_LIFT } from '../../logic/run/enemies';
import { epley1RM } from '../../logic/strength';
import { fromKg } from '../../logic/units';
import type { BossLift, LoggedSet, Settings } from '../../types';
import type { Route } from '../App';
import { CREATURES } from '../art/creatures';
import { MuscleIcon, Pixel } from '../art/Pixel';
import { CROWN, SKULL } from '../art/sprites';
import { MOD_ICON } from '../components/ModifierPicker';

const LIFTS: BossLift[] = ['squat', 'bench', 'deadlift', 'ohp'];

/** Best estimated 1RM per session, oldest first (last 12 sessions). */
function trend(sets: LoggedSet[], exerciseId: string): { at: number; v: number }[] {
  const by = new Map<number, { at: number; v: number }>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.isWarmup) continue;
    const v = epley1RM(s.weightKg, s.reps);
    const cur = by.get(s.sessionId);
    if (!cur || v > cur.v) by.set(s.sessionId, { at: s.loggedAt, v });
  }
  return [...by.values()].sort((a, b) => a.at - b.at).slice(-12);
}

/** One-series sparkline: faint area, gold line, emphasized endpoint; tap a point to read it. */
function Sparkline({ points, unit, label }: { points: { at: number; v: number }[]; unit: Settings['unit']; label: string }) {
  const [sel, setSel] = useState<number | null>(null);
  if (points.length < 2) return <p className="small muted">Log this lift twice to see a trend.</p>;
  const W = 200;
  const H = 36;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 4 - ((v - min) / span) * (H - 8);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const shown = sel ?? points.length - 1;
  return (
    <div>
      <svg
        className="spark"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: from ${fromKg(points[0].v, unit)} to ${fromKg(vs[vs.length - 1], unit)} ${unit} over ${points.length} sessions`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect();
          setSel(Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)));
        }}
        onPointerLeave={() => setSel(null)}
      >
        <path className="spark-area" d={`${d} L${W},${H} L0,${H} Z`} />
        <path className="spark-line" d={d} />
        <circle className="spark-dot" cx={x(shown)} cy={y(points[shown].v)} r={3} />
      </svg>
      <p className="small muted">
        {new Date(points[shown].at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: est. 1RM {fromKg(points[shown].v, unit)} {unit}
      </p>
    </div>
  );
}

export function CharacterScreen({ settings, go }: { settings: Settings; go: (r: Route) => void }) {
  const [tab, setTab] = useState<'strength' | 'cards' | 'legend'>('strength');
  const sets = useLiveQuery(() => db.sets.toArray(), [], [] as LoggedSet[]);
  const sessions = useLiveQuery(() => db.sessions.filter((s) => !!s.endedAt).count(), [], 0);
  const working = sets.filter((s) => !s.isWarmup);
  const prs = working.filter((s) => s.isPR).length;
  const nemeses = settings.nemeses ?? [];
  const progress = settings.modifierProgress ?? 0;
  const unlocked = unlockedModifiers(progress);
  const deckMastery = settings.deck
    .map((id) => ({ id, level: masteryLevel(getExercise(id), sets.filter((s) => s.exerciseId === id)) }))
    .sort((a, b) => b.level - a.level);

  return (
    <Screen scene="calm" floor={false} torches={false} className="list-screen">
      <TopBar
        left={<button className="icon-btn" onClick={() => go({ name: 'home' })} aria-label="Back to camp">←</button>}
        center={<h1 className="screen-title outlined">Hero</h1>}
      />
      <div className="tiles">
        <div className="tile"><b>{sessions}</b><small>Quests</small></div>
        <div className="tile"><b>{settings.runsCleared ?? 0}</b><small>Cleared</small></div>
        <div className="tile"><b>{working.length}</b><small>Sets</small></div>
        <div className="tile"><b><Pixel sprite={CROWN} size={16} />{prs}</b><small>PRs</small></div>
      </div>
      <Tabs
        tabs={[
          { id: 'strength', label: 'Strength' },
          { id: 'cards', label: 'Mastery' },
          { id: 'legend', label: 'Legend' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="scroll-area">
        {tab === 'strength' && (
          <div className="panel stack">
            {LIFTS.map((lift) => {
              const ex = compoundFor(lift);
              const pts = trend(sets, ex.id);
              const best = pts.length ? Math.max(...pts.map((p) => p.v)) : null;
              const boss = BOSS_FOR_LIFT[lift];
              return (
                <div key={lift}>
                  <div className="lift-row">
                    <Pixel sprite={CREATURES[boss.kind]} size={32} recolor={boss.recolor} />
                    <span className="lift-name">{ex.name}</span>
                    <span className="lift-value">{best ? `${fromKg(best, settings.unit)} ${settings.unit}` : '—'}</span>
                  </div>
                  {pts.length > 0 && <Sparkline points={pts} unit={settings.unit} label={`${ex.name} estimated 1RM`} />}
                </div>
              );
            })}
          </div>
        )}
        {tab === 'cards' && (
          <div className="panel stack">
            {deckMastery.map(({ id, level }) => (
              <div key={id} className="lift-row">
                <MuscleIcon muscle={getExercise(id).primaryMuscles[0]} size={22} />
                <span>{getExercise(id).name}</span>
                <span className={`tier tier-text-${masteryTier(level).toLowerCase()}`}>
                  {masteryTier(level)} {level}
                </span>
              </div>
            ))}
            <p className="small muted">Cards level up every +{config.mastery.stepPct * 100}% on your estimated 1RM. No level cap.</p>
          </div>
        )}
        {tab === 'legend' && (
          <>
            <p className="section-label">Modifiers · {progress} progress</p>
            <div className="panel stack">
              {MODIFIER_ORDER.map((m) => (
                <div key={m} className="lift-row">
                  <Pixel sprite={MOD_ICON[m]} size={24} />
                  <span>
                    {MODIFIER_INFO[m].name}
                    <small className="muted"> {MODIFIER_INFO[m].effect}</small>
                  </span>
                  <span className={unlocked.includes(m) ? 'good' : 'muted'}>
                    {unlocked.includes(m) ? 'Open' : `${config.modifiers.unlocks[m] - progress} to go`}
                  </span>
                </div>
              ))}
              <p className="small muted">+1 per cleared quest, +2 per nemesis slain.</p>
            </div>
            <p className="section-label">Nemeses</p>
            <div className="panel stack">
              {nemeses.length === 0 ? (
                <p className="muted">No boss has escaped you yet.</p>
              ) : (
                nemeses.map((n) => (
                  <div key={n.id} className="lift-row">
                    <Pixel sprite={n.defeatedAt ? CROWN : SKULL} size={24} recolor={n.defeatedAt ? undefined : { w: '#a7f070' }} />
                    <span>
                      {n.name}
                      <small className="muted"> {compoundFor(n.lift).name} {fromKg(n.targetWeightKg, settings.unit)}×{n.targetReps}</small>
                    </span>
                    <span className={n.defeatedAt ? 'good' : 'warn'}>{n.defeatedAt ? 'Slain' : 'At large'}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

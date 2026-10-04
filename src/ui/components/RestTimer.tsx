import { useEffect, useRef } from 'react';
import { config } from '../../config';
import { findExercise } from '../../data/exercises';
import { stopRest } from '../../db/repo';
import { restPhase, restWindow, type RestPhase } from '../../logic/rest';
import type { Session, Settings } from '../../types';
import { buzz } from '../feedback';
import { formatClock, useNow } from '../hooks';

const LABEL: Record<RestPhase, string> = {
  resting: 'Resting',
  ready: 'Ready — go!',
  late: 'Rest window closing',
  overdue: 'Overdue',
};

export function RestTimer({ session, settings }: { session: Session; settings: Settings }) {
  const now = useNow(250);
  const ex = session.restExerciseId ? findExercise(session.restExerciseId) : undefined;
  const elapsed = session.restStartedAt ? (now - session.restStartedAt) / 1000 : 0;
  const phase = ex ? restPhase(ex, elapsed) : 'resting';

  // Buzz once when the rest window opens and once when it is about to be overdue.
  const lastPhase = useRef<RestPhase>(phase);
  useEffect(() => {
    if (lastPhase.current === phase) return;
    if (phase === 'ready') buzz(settings, [200, 100, 200]);
    if (phase === 'overdue') buzz(settings, [400]);
    lastPhase.current = phase;
  }, [phase, settings]);

  if (!session.restStartedAt || !ex) return null;
  const w = restWindow(ex);
  const end = w.max + config.rest.grace;
  const pct = Math.min(100, (elapsed / end) * 100);

  return (
    <div className={`rest panel pixel-corners rest-${phase}`}>
      <div className="rest-content">
        <div>
          <div className="rest-label">{LABEL[phase]}</div>
          <div className="rest-sub">
            {ex.name} · window {formatClock(w.min)}–{formatClock(w.max)}
          </div>
        </div>
        <div className="rest-time">{formatClock(elapsed)}</div>
        <button className="rest-close" onClick={() => stopRest(session.id!)} aria-label="Stop rest timer">
          ×
        </button>
      </div>
      <div className="rest-track">
        <div className="rest-bar" style={{ width: `${pct}%` }} />
        <span className="rest-mark" style={{ left: `${(w.min / end) * 100}%` }} />
        <span className="rest-mark" style={{ left: `${(w.max / end) * 100}%` }} />
      </div>
    </div>
  );
}

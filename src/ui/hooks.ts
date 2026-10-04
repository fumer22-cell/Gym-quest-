import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getSettings } from '../db/repo';
import type { Settings } from '../types';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), []);
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Two-tap confirm for destructive buttons: first tap arms, second tap (within 3s) fires. */
export function useConfirm(): [boolean, (action: () => void) => void] {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return [
    armed,
    (action) => {
      if (armed) {
        setArmed(false);
        action();
      } else setArmed(true);
    },
  ];
}

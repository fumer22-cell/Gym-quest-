import { useEffect, useState } from 'react';

/**
 * One shared interval per frame rate drives every sprite animation, so twenty torches don't
 * mean twenty timers. Honors reduced motion by freezing on frame 0.
 */
const subs = new Map<number, { timer: ReturnType<typeof setInterval>; fns: Set<(f: number) => void>; frame: number }>();

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useTicker(ms: number): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    let entry = subs.get(ms);
    if (!entry) {
      const fns = new Set<(f: number) => void>();
      const e = { fns, frame: 0, timer: setInterval(() => {
        e.frame += 1;
        fns.forEach((fn) => fn(e.frame));
      }, ms) };
      entry = e;
      subs.set(ms, e);
    }
    entry.fns.add(setFrame);
    return () => {
      const e = subs.get(ms);
      if (!e) return;
      e.fns.delete(setFrame);
      if (e.fns.size === 0) {
        clearInterval(e.timer);
        subs.delete(ms);
      }
    };
  }, [ms]);
  return frame;
}

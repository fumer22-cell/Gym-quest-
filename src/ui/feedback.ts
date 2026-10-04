import type { Settings } from '../types';

export function buzz(settings: Settings | undefined, pattern: number | number[]) {
  if (!settings?.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration unsupported (e.g. iOS Safari) — silently ignore.
  }
}

/**
 * Tiny synthesized chiptune effects (Web Audio, no files). Toggle in Settings.
 * Browsers only allow audio after the first tap, which every effect here follows.
 */
import type { Settings } from '../types';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.08, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export type Sfx = 'hit' | 'crit' | 'break' | 'hurt' | 'victory' | 'ready' | 'heal' | 'select' | 'defeat';

const EFFECTS: Record<Sfx, () => void> = {
  hit: () => {
    tone(220, 0, 0.08, 'square', 0.09, 110);
    tone(90, 0, 0.12, 'triangle', 0.12, 50);
  },
  crit: () => {
    tone(330, 0, 0.07, 'square', 0.09);
    tone(440, 0.07, 0.07, 'square', 0.09);
    tone(660, 0.14, 0.18, 'square', 0.1);
  },
  break: () => {
    tone(880, 0, 0.3, 'sawtooth', 0.08, 110);
    tone(523, 0.12, 0.1, 'square', 0.08);
    tone(784, 0.22, 0.25, 'square', 0.09);
  },
  hurt: () => tone(160, 0, 0.25, 'sawtooth', 0.1, 60),
  victory: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.16, 'square', 0.08)),
  ready: () => {
    tone(784, 0, 0.1, 'triangle', 0.12);
    tone(1047, 0.12, 0.16, 'triangle', 0.12);
  },
  heal: () => [392, 523, 659].forEach((f, i) => tone(f, i * 0.07, 0.12, 'triangle', 0.1)),
  select: () => tone(660, 0, 0.05, 'square', 0.05),
  defeat: () => tone(300, 0, 0.35, 'square', 0.08, 80),
};

export function sfx(settings: Settings | undefined, kind: Sfx) {
  if (!settings?.sound) return;
  try {
    EFFECTS[kind]();
  } catch {
    // Audio unavailable: stay silent.
  }
}

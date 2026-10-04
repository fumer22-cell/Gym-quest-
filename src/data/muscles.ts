import type { Muscle } from '../types';

/** Colors come from the Sweetie 16 palette used by the sprites. */
export const MUSCLE_INFO: Record<Muscle, { label: string; short: string; color: string }> = {
  chest: { label: 'Chest', short: 'Chest', color: '#b13e53' },
  back: { label: 'Back', short: 'Back', color: '#41a6f6' },
  shoulders: { label: 'Shoulders', short: 'Delts', color: '#ef7d57' },
  biceps: { label: 'Biceps', short: 'Bis', color: '#ffcd75' },
  triceps: { label: 'Triceps', short: 'Tris', color: '#94b0c2' },
  quads: { label: 'Quads', short: 'Quads', color: '#a7f070' },
  hamstrings_glutes: { label: 'Hamstrings / Glutes', short: 'Hams', color: '#38b764' },
  core: { label: 'Core', short: 'Core', color: '#73eff7' },
};

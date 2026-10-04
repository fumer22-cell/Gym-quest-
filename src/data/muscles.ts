import type { Muscle } from '../types';

export const MUSCLE_INFO: Record<Muscle, { label: string; short: string; color: string }> = {
  chest: { label: 'Chest', short: 'Chest', color: '#e0565b' },
  back: { label: 'Back', short: 'Back', color: '#4f8fe6' },
  shoulders: { label: 'Shoulders', short: 'Delts', color: '#e8a33d' },
  biceps: { label: 'Biceps', short: 'Bis', color: '#9b6be8' },
  triceps: { label: 'Triceps', short: 'Tris', color: '#d86bc4' },
  quads: { label: 'Quads', short: 'Quads', color: '#46b97a' },
  hamstrings_glutes: { label: 'Hamstrings / Glutes', short: 'Hams/Glutes', color: '#2fb3b3' },
  core: { label: 'Core', short: 'Core', color: '#c9c14a' },
};

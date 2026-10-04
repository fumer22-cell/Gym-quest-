import { config } from '../config';
import type { Unit } from '../types';

export function toKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * config.kgPerLb;
}

export function fromKg(kg: number, unit: Unit): number {
  const v = unit === 'kg' ? kg : kg / config.kgPerLb;
  const f = 10 ** config.displayDecimals;
  return Math.round(v * f) / f;
}

export function formatWeight(kg: number, unit: Unit): string {
  return `${fromKg(kg, unit)} ${unit}`;
}

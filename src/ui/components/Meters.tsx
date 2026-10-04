import { config } from '../../config';
import { MUSCLE_INFO } from '../../data/muscles';
import type { MuscleMeter, Meters } from '../../logic/fatigue';
import { MUSCLES, type Muscle } from '../../types';
import { MuscleIcon } from '../art/Pixel';
import { muscleStyle } from './ExerciseCard';

const fmt = (n: number) => String(Math.round(n * 10) / 10);

function tag(m: MuscleMeter): string {
  const { min, max } = config.volume.targetZone;
  if (m.status === 'cap') return 'LOCKED';
  if (m.status === 'zone') return m.sessionSets >= max ? 'Max' : `In zone`;
  return `${fmt(Math.max(0, min - m.sessionSets))} to go`;
}

export function MeterRow({ muscle, meter }: { muscle: Muscle; meter: MuscleMeter }) {
  const cap = config.volume.fatigueCap;
  const { min, max } = config.volume.targetZone;
  const pct = (v: number) => `${Math.min(100, (v / cap) * 100)}%`;
  const carryStart = Math.min(meter.sessionSets, cap);
  const carryLabel = meter.carryover >= 0.05 ? ` + ${fmt(meter.carryover)} carryover` : '';
  return (
    <div
      className={`meter meter-${meter.status}`}
      style={muscleStyle(muscle)}
      aria-label={`${MUSCLE_INFO[muscle].label}: ${fmt(meter.sessionSets)} sets today${carryLabel}, ${tag(meter)}`}
    >
      <MuscleIcon muscle={muscle} size={28} className="meter-icon" />
      <div className="meter-head">
        <span className="meter-name">{MUSCLE_INFO[muscle].short}</span>
        <span className="meter-tag">{tag(meter)}</span>
      </div>
      <div className="meter-bar">
        <span className="meter-zone-mark" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }} />
        <span className="meter-fill" style={{ width: `calc(${pct(meter.sessionSets)} - 2px)` }} />
        {meter.carryover > 0 && (
          <span className="meter-carry" style={{ left: pct(carryStart), width: pct(Math.min(meter.carryover, cap - carryStart)) }} />
        )}
      </div>
    </div>
  );
}

export function MeterGrid({ meters }: { meters: Meters }) {
  return (
    <div className="meters">
      {MUSCLES.map((m) => (
        <MeterRow key={m} muscle={m} meter={meters[m]} />
      ))}
    </div>
  );
}

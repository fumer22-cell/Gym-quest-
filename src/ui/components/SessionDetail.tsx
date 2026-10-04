import { getExercise } from '../../data/exercises';
import { muscleMeters } from '../../logic/fatigue';
import { fromKg } from '../../logic/units';
import { groupByExercise } from '../../logic/volume';
import type { LoggedSet, Settings } from '../../types';
import { MuscleIcon } from '../art/Pixel';
import { MeterGrid } from './Meters';

/** Exercise-by-exercise log plus the muscle meters for that workout alone (no carryover). */
export function SessionDetail({ sets, settings }: { sets: LoggedSet[]; settings: Settings }) {
  return (
    <div className="session-detail">
      <ul className="detail-list">
        {groupByExercise(sets).map(([exId, exSets]) => {
          const ex = getExercise(exId);
          const dmg = exSets.reduce((sum, s) => sum + (s.damage ?? 0), 0);
          return (
            <li key={exId}>
              <MuscleIcon muscle={ex.primaryMuscles[0]} size={32} />
              <div style={{ minWidth: 0 }}>
                <div className="log-name">{ex.name}</div>
                <div className="log-sets">
                  {exSets
                    .map(
                      (s) =>
                        (s.isWarmup ? 'W ' : s.isPR ? '★' : '') +
                        (ex.isBodyweight ? `${s.reps} reps` : `${fromKg(s.weightKg, settings.unit)}×${s.reps}`),
                    )
                    .join(' · ')}
                </div>
              </div>
              <span className="log-dmg">{dmg}</span>
            </li>
          );
        })}
      </ul>
      <MeterGrid meters={muscleMeters(sets, [], 0)} />
    </div>
  );
}

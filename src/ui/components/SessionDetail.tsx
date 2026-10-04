import { config } from '../../config';
import { getExercise } from '../../data/exercises';
import { MUSCLE_INFO } from '../../data/muscles';
import { fromKg } from '../../logic/units';
import { groupByExercise, setsByMuscle } from '../../logic/volume';
import { MUSCLES, type LoggedSet, type Settings } from '../../types';

export function SessionDetail({ sets, settings }: { sets: LoggedSet[]; settings: Settings }) {
  const byMuscle = setsByMuscle(sets);
  return (
    <div className="session-detail">
      <ul className="detail-list">
        {groupByExercise(sets).map(([exId, exSets]) => {
          const ex = getExercise(exId);
          return (
            <li key={exId}>
              <div className="log-name">{ex.name}</div>
              <div className="log-sets">
                {exSets
                  .map((s) =>
                    (s.isWarmup ? 'W ' : '') +
                    (ex.isBodyweight ? `${s.reps} reps` : `${fromKg(s.weightKg, settings.unit)}×${s.reps}`),
                  )
                  .join(' · ')}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="muscle-bars">
        {MUSCLES.map((m) => (
          <div key={m} className="muscle-bar">
            <span className="muscle-bar-label">{MUSCLE_INFO[m].short}</span>
            <span className="muscle-bar-track">
              <span
                className="muscle-bar-fill"
                style={{ width: `${Math.min(100, (byMuscle[m] / config.volume.targetZone.max) * 100)}%`, background: MUSCLE_INFO[m].color }}
              />
            </span>
            <span className="muscle-bar-num">{byMuscle[m]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

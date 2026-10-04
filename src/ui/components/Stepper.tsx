import { useEffect, useState } from 'react';

/** Big −/+ stepper with a tappable, editable value in the middle. */
export function Stepper({
  label,
  value,
  step,
  min = 0,
  suffix,
  decimals = 1,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  suffix?: string;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const round = (v: number) => {
    const f = 10 ** decimals;
    return Math.max(min, Math.round(v * f) / f);
  };

  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(v)) onChange(round(v));
    else setText(String(value));
  };

  return (
    <div className="stepper">
      <div className="stepper-label">{label}</div>
      <div className="stepper-row">
        <button className="step-btn" onClick={() => onChange(round(value - step))} aria-label={`Decrease ${label}`}>
          −
        </button>
        <label className="stepper-value">
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onFocus={(e) => e.target.select()}
            aria-label={label}
          />
          {suffix && <span className="stepper-suffix">{suffix}</span>}
        </label>
        <button className="step-btn" onClick={() => onChange(round(value + step))} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

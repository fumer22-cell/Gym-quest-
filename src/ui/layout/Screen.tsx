import { useEffect, type ReactNode } from 'react';
import { Scene, type SceneVariant } from '../scene/Scene';

/** A full-height, non-scrolling screen over an animated scene. */
export function Screen({
  scene = 'calm',
  floor,
  torches,
  className = '',
  children,
}: {
  scene?: SceneVariant;
  floor?: boolean;
  torches?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`app ${className}`}>
      <Scene variant={scene} floor={floor} torches={torches} />
      <div className="app-content">{children}</div>
    </div>
  );
}

export function TopBar({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-left">{left}</div>
      <div className="topbar-center">{center}</div>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

/** Bottom sheet for secondary content (menus, meters, pickers) so screens never scroll. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title outlined">{title}</h2>
          <button className="btn btn-ghost sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** Segmented tabs that swap content in place. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'tab-on' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

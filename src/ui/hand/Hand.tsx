import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { getExercise } from '../../data/exercises';
import { GameCard, type CardInfo } from '../components/ExerciseCard';

interface Drag {
  id: string;
  pointer: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  moved: boolean;
}

const TAP_SLOP = 8;

/**
 * The hand: cards fanned along the bottom edge. Drag a card up to play it, or tap to lift it
 * (then tap again or use the action bar). Cards deal in from the deck and fly up when played.
 */
export function Hand({
  cards,
  onPlay,
  onSwap,
  onDiscard,
  emptyText = 'No card can hit these enemies right now.',
}: {
  cards: CardInfo[];
  onPlay: (id: string) => void;
  onSwap?: (id: string) => void;
  onDiscard?: (id: string) => void;
  emptyText?: string;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 200 });
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [bounce, setBounce] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (selected && !cards.some((c) => c.id === selected)) setSelected(null);
  }, [cards, selected]);

  const n = cards.length;
  const actionSpace = 44;
  const mid = (n - 1) / 2;
  const fanDrop = (k: number) => k * k * 4;
  // Cards fill the width with ~10% overlap so every name stays readable, capped by the zone's height.
  const maxH = size.h - actionSpace - 10 - fanDrop(mid);
  const cardW = Math.max(72, Math.min(maxH / 1.42, (size.w - 20) / Math.max(1, n * 0.9 + 0.1), 170));
  const realH = cardW * 1.42;
  const spacing = n > 1 ? Math.min(cardW * 0.98, (size.w - cardW - 16) / (n - 1)) : 0;
  const baseY = size.h - realH - 8 - fanDrop(mid);
  const playLine = realH * 0.45;

  const blocked = (c: CardInfo) => !!c.lockedBy || !!c.disrupted;

  const play = (c: CardInfo) => {
    if (blocked(c)) {
      setBounce(c.id);
      setTimeout(() => setBounce(null), 400);
      return;
    }
    setLeaving(c.id);
    setSelected(null);
    setTimeout(() => {
      setLeaving(null);
      onPlay(c.id);
    }, 230);
  };

  const down = (c: CardInfo, e: RPointerEvent) => {
    if (leaving || e.button > 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: c.id, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const move = (e: RPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > TAP_SLOP });
  };
  const up = (c: CardInfo, e: RPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      if (selected === c.id) play(c);
      else setSelected(c.id);
      return;
    }
    if (d.dy < -playLine) play(c);
  };

  const sel = cards.find((c) => c.id === selected);

  return (
    <div
      className="hand-zone"
      ref={zone}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
    >
      {n === 0 && <p className="hand-empty">{emptyText}</p>}
      <div className="hand-actions" aria-live="polite">
        {sel ? (
          <>
            <span className="hand-actions-name">{getExercise(sel.id).name}</span>
            {blocked(sel) ? (
              onDiscard && (
                <button className="btn btn-small" onClick={() => onDiscard(sel.id)}>
                  Discard
                </button>
              )
            ) : (
              <>
                {onSwap && (
                  <button className="btn btn-small" onClick={() => onSwap(sel.id)} aria-label="Machine taken: swap for a similar exercise">
                    ⇄ Swap
                  </button>
                )}
                <button className="btn btn-small btn-primary" onClick={() => play(sel)}>
                  Play ▲
                </button>
              </>
            )}
          </>
        ) : (
          n > 0 && <span className="hand-hint">Drag a card up to play · tap to inspect</span>
        )}
      </div>
      {cards.map((c, i) => {
        const off = i - mid;
        let x = size.w / 2 - cardW / 2 + off * spacing;
        let y = baseY + fanDrop(Math.abs(off));
        let rot = n > 1 ? off * 4 : 0;
        let scale = 1;
        let z = i + 1;
        const dragging = drag?.id === c.id && drag.moved;
        const isSel = selected === c.id;
        if (isSel) {
          y = baseY - realH * 0.14;
          rot = 0;
          scale = 1.1;
          z = 50;
        }
        if (dragging) {
          x += drag!.dx;
          y = baseY + drag!.dy;
          rot = drag!.dx * 0.06;
          scale = 1.1;
          z = 100;
        }
        if (leaving === c.id) {
          y = -realH * 1.2;
          scale = 0.7;
          z = 100;
        }
        const armed = dragging && drag!.dy < -playLine;
        return (
          <div
            key={c.id}
            className={`hand-slot ${dragging ? 'dragging' : ''} ${leaving === c.id ? 'leaving' : ''} ${armed ? 'armed' : ''} ${bounce === c.id ? 'bounce' : ''}`}
            style={{
              width: cardW,
              height: realH,
              zIndex: z,
              transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
            }}
            onPointerDown={(e) => down(c, e)}
            onPointerMove={move}
            onPointerUp={(e) => up(c, e)}
            onPointerCancel={() => setDrag(null)}
            role="button"
            tabIndex={0}
            aria-label={`${getExercise(c.id).name}${blocked(c) ? ' (unavailable)' : ''}. Drag up or press Enter to play.`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                play(c);
              }
            }}
          >
            <div className="hand-deal" style={{ animationDelay: `${i * 70}ms` }}>
              <GameCard card={c} selected={isSel || armed} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

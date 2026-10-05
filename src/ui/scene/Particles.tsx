import { useEffect, useRef } from 'react';

export type ParticleKind = 'embers' | 'dust' | 'sparkle' | 'ash';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

const COLORS: Record<ParticleKind, string[]> = {
  embers: ['#ffcd75', '#ef7d57', '#b13e53'],
  dust: ['#566c86', '#94b0c2', '#333c57'],
  sparkle: ['#ffcd75', '#f4f4f4', '#73eff7'],
  ash: ['#94b0c2', '#ef7d57', '#566c86'],
};

/**
 * Ambient pixel particles on a low-res canvas (scaled up crisp). Pauses when hidden and
 * draws nothing for reduced-motion users.
 */
export function Particles({ kind, density = 1 }: { kind: ParticleKind; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const SCALE = 3;
    let w = 0;
    let h = 0;
    const resize = () => {
      w = Math.max(1, Math.floor(canvas.clientWidth / SCALE));
      h = Math.max(1, Math.floor(canvas.clientHeight / SCALE));
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const colors = COLORS[kind];
    const target = Math.round((kind === 'dust' ? 26 : 34) * density);
    const ps: P[] = [];
    const spawn = (anywhere: boolean): P => {
      const rising = kind !== 'dust';
      const max = 200 + Math.random() * 260;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : rising ? h + 2 : Math.random() * h,
        vx: (Math.random() - 0.5) * (kind === 'dust' ? 0.06 : 0.12),
        vy: rising ? -(0.08 + Math.random() * (kind === 'sparkle' ? 0.12 : 0.22)) : (Math.random() - 0.5) * 0.03,
        life: anywhere ? Math.random() * max : 0,
        max,
        size: Math.random() < 0.2 ? 2 : 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    };
    for (let i = 0; i < target; i++) ps.push(spawn(true));
    let raf = 0;
    let t = 0;
    const tick = () => {
      t++;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.life += 1;
        p.x += p.vx + Math.sin((t + i * 37) / 60) * 0.05;
        p.y += p.vy;
        if (p.life > p.max || p.y < -3 || p.x < -3 || p.x > w + 3) {
          ps[i] = spawn(false);
          continue;
        }
        const fade = Math.min(1, p.life / 30, (p.max - p.life) / 40);
        const twinkle = kind === 'sparkle' ? 0.5 + 0.5 * Math.sin((t + i * 13) / 6) : 1;
        ctx.globalAlpha = Math.max(0, fade * twinkle) * (kind === 'dust' ? 0.5 : 0.9);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [kind, density]);
  return <canvas ref={ref} className="particles" aria-hidden="true" />;
}

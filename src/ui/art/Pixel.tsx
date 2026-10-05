import { useEffect, useState } from 'react';
import type { Muscle } from '../../types';
import { spriteUrl } from './render';
import { CAMPFIRE, MUSCLE_SPRITES, type Sprite } from './sprites';

/** A sprite drawn at `size` CSS pixels (a multiple of the sprite size keeps pixels square). */
export function Pixel({
  sprite,
  size,
  alt = '',
  className,
  recolor,
}: {
  sprite: Sprite;
  size: number;
  alt?: string;
  className?: string;
  recolor?: Record<string, string>;
}) {
  const scale = Math.max(1, Math.ceil(size / sprite.w));
  return (
    <img
      className={`pixel ${className ?? ''}`}
      src={spriteUrl(sprite, scale, recolor)}
      width={size}
      height={(size / sprite.w) * sprite.h}
      alt={alt}
      draggable={false}
    />
  );
}

export function MuscleIcon({ muscle, size = 32, className }: { muscle: Muscle; size?: number; className?: string }) {
  return <Pixel sprite={MUSCLE_SPRITES[muscle]} size={size} className={className} />;
}

export function Campfire({ size = 96 }: { size?: number }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % CAMPFIRE.length), 160);
    return () => clearInterval(t);
  }, []);
  return <Pixel sprite={CAMPFIRE[frame]} size={size} alt="" className="campfire" />;
}

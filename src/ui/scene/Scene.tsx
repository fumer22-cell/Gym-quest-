import { Pixel } from '../art/Pixel';
import { TORCH } from '../art/sprites';
import { useTicker } from '../art/ticker';
import { Particles, type ParticleKind } from './Particles';

export type SceneVariant = 'camp' | 'dungeon' | 'boss' | 'map' | 'victory' | 'calm';

const PARTICLES: Record<SceneVariant, { kind: ParticleKind; density: number }> = {
  camp: { kind: 'embers', density: 1.1 },
  dungeon: { kind: 'dust', density: 1 },
  boss: { kind: 'ash', density: 1.4 },
  map: { kind: 'dust', density: 0.8 },
  victory: { kind: 'sparkle', density: 1.3 },
  calm: { kind: 'dust', density: 0.6 },
};

function Torch({ side, delay }: { side: 'left' | 'right'; delay: number }) {
  const frame = useTicker(140);
  return (
    <div className={`torch torch-${side}`}>
      <span className="torch-glow" style={{ animationDelay: `${delay}ms` }} />
      <Pixel sprite={TORCH[(frame + delay) % TORCH.length]} size={24} />
    </div>
  );
}

/**
 * The world behind every screen: a torch-lit dungeon wall, a flagstone floor, drifting fog
 * and ambient particles. Variants retint it per situation (boss = red haze, camp = warm glow).
 */
export function Scene({ variant, floor = true, torches = true }: { variant: SceneVariant; floor?: boolean; torches?: boolean }) {
  const p = PARTICLES[variant];
  return (
    <div className={`scene scene-${variant}`} aria-hidden="true">
      <div className="scene-wall" />
      {torches && (
        <>
          <Torch side="left" delay={0} />
          <Torch side="right" delay={1} />
        </>
      )}
      {floor && <div className="scene-floor" />}
      <div className="scene-fog" />
      <div className="scene-fog scene-fog-2" />
      <Particles kind={p.kind} density={p.density} />
      <div className="scene-vignette" />
    </div>
  );
}

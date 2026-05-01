import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactElement } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points } from 'three';

import { NAVIGATION_RADIUS } from './constants';

const PARTICLE_COUNT = 42;
const FIELD_RADIUS = NAVIGATION_RADIUS * 0.95;
const Y_BASE = 0.35;
const Y_AMPLITUDE = 1.6;
const PARTICLE_COLOR = '#ffe9a8';

interface ParticleSeed {
  baseX: number;
  baseZ: number;
  baseY: number;
  ampY: number;
  ampX: number;
  ampZ: number;
  speedY: number;
  speedX: number;
  speedZ: number;
  phaseY: number;
  phaseX: number;
  phaseZ: number;
}

function buildSeeds(count: number): ParticleSeed[] {
  const seeds: ParticleSeed[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * FIELD_RADIUS;
    seeds.push({
      baseX: Math.cos(angle) * radius,
      baseZ: Math.sin(angle) * radius,
      baseY: Y_BASE + Math.random() * Y_AMPLITUDE,
      ampY: 0.18 + Math.random() * 0.32,
      ampX: 0.12 + Math.random() * 0.22,
      ampZ: 0.12 + Math.random() * 0.22,
      speedY: 0.25 + Math.random() * 0.35,
      speedX: 0.18 + Math.random() * 0.28,
      speedZ: 0.18 + Math.random() * 0.28,
      phaseY: Math.random() * Math.PI * 2,
      phaseX: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2,
    });
  }
  return seeds;
}

export function HubAmbientParticles(): ReactElement {
  const pointsRef = useRef<Points>(null);
  const seeds = useMemo(() => buildSeeds(PARTICLE_COUNT), []);

  const geometry = useMemo(() => {
    const geom = new BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const seed = seeds[i];
      positions[i * 3] = seed.baseX;
      positions[i * 3 + 1] = seed.baseY;
      positions[i * 3 + 2] = seed.baseZ;
    }
    geom.setAttribute('position', new BufferAttribute(positions, 3));
    return geom;
  }, [seeds]);

  useFrame((state) => {
    const points = pointsRef.current;
    if (!points) return;
    const t = state.clock.getElapsedTime();
    const attr = points.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const seed = seeds[i];
      arr[i * 3] = seed.baseX + Math.sin(t * seed.speedX + seed.phaseX) * seed.ampX;
      arr[i * 3 + 1] = seed.baseY + Math.sin(t * seed.speedY + seed.phaseY) * seed.ampY;
      arr[i * 3 + 2] = seed.baseZ + Math.cos(t * seed.speedZ + seed.phaseZ) * seed.ampZ;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.085}
        color={PARTICLE_COLOR}
        transparent
        opacity={0.85}
        depthWrite={false}
        sizeAttenuation
        blending={AdditiveBlending}
      />
    </points>
  );
}

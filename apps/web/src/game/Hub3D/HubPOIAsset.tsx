import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef, type ReactElement } from 'react';
import {
  Box3,
  DoubleSide,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type PointLight,
} from 'three';

import { useHubGround } from './HubGround';
import { HUB_POIS, type PoiConfig, type PoiCustomEffect } from './constants';

interface HubPOIAssetProps {
  poi: PoiConfig;
  hovered: boolean;
}

const HOVER_SCALE = 1.08;
const DEFAULT_ASSET_SCALE = 1;
const DEFAULT_ASSET_ROT_Y = 0;
const POI_FACE_DEBUG = false;

const CRYSTAL_SPIN_RATE = 0.6;
const CRYSTAL_BASE_Y = 0.55;
const CRYSTAL_BOB_FREQ = 1.6;
const CRYSTAL_BOB_AMP = 0.08;
const GLOW_RING_RADIUS = 0.95;
const GLOW_RING_TUBE = 0.12;
const RING_RADIUS = 0.7;
const RING_TUBE = 0.05;

const AURA_COLOR_DISC = '#7dd3fc';
const AURA_COLOR_OUTER = '#3b82f6';
const AURA_COLOR_INNER = '#bae6fd';
const AURA_COLOR_LIGHT = '#60a5fa';

const AURA_GROUND_Y = 0.0000121212;
const AURA_LAYER_GAP = 0.005;

for (const poi of Object.values(HUB_POIS)) {
  if (poi.modelPath) {
    useGLTF.preload(poi.modelPath);
  }
}

function usePoiRotationY(poi: PoiConfig): number {
  const { pivotRef, ready } = useHubGround();
  return useMemo(() => {
    if (!poi.faceCenter) return poi.assetRotationY ?? DEFAULT_ASSET_ROT_Y;
    const pivot = pivotRef.current;
    const dx = pivot.x - poi.position[0];
    const dz = pivot.z - poi.position[2];
    const baseRotationY = Math.atan2(dx, dz);
    const finalRotationY = baseRotationY + (poi.rotationOffsetY ?? 0);
    if (POI_FACE_DEBUG) {
      console.warn('[POI face]', { id: poi.id, base: baseRotationY.toFixed(3), offset: (poi.rotationOffsetY ?? 0).toFixed(3), final: finalRotationY.toFixed(3) });
    }
    return finalRotationY;
  }, [poi, pivotRef, ready]);
}

export function HubPOIAsset({ poi, hovered }: HubPOIAssetProps): ReactElement {
  const rotationY = usePoiRotationY(poi);
  if (!poi.modelPath) {
    return <PoiPlaceholderVisuals color={poi.color} hovered={hovered} />;
  }
  return (
    <group rotation={[0, rotationY, 0]}>
      <Suspense fallback={<PoiPlaceholderVisuals color={poi.color} hovered={hovered} />}>
        <GlbVisual
          modelPath={poi.modelPath}
          baseScale={poi.assetScale ?? DEFAULT_ASSET_SCALE}
          hovered={hovered}
        />
      </Suspense>
      {poi.customEffect && <CustomEffect effect={poi.customEffect} hovered={hovered} />}
    </group>
  );
}

interface GlbVisualProps {
  modelPath: string;
  baseScale: number;
  hovered: boolean;
}

function GlbVisual({ modelPath, baseScale, hovered }: GlbVisualProps): ReactElement {
  const { scene } = useGLTF(modelPath);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const fitYOffsetUnscaled = useMemo(() => {
    const box = new Box3().setFromObject(cloned);
    return -box.min.y;
  }, [cloned]);
  const scale = baseScale * (hovered ? HOVER_SCALE : 1);
  return <primitive object={cloned} scale={scale} position={[0, fitYOffsetUnscaled * scale, 0]} />;
}

function CustomEffect({ effect, hovered }: { effect: PoiCustomEffect; hovered: boolean }): ReactElement | null {
  if (effect.type === 'vs-ai-aura') {
    return <VsAiAura config={effect} hovered={hovered} />;
  }
  if (effect.type === 'appearance-aura') {
    return <AppearanceAura config={effect} hovered={hovered} />;
  }
  if (effect.type === 'rooms-aura') {
    return <RoomsAura config={effect} hovered={hovered} />;
  }
  return null;
}

interface VsAiAuraProps {
  config: PoiCustomEffect;
  hovered: boolean;
}

function VsAiAura({ config, hovered }: VsAiAuraProps): ReactElement {
  const offsetY = config.offsetY ?? 1.4;
  const radius = config.radius ?? 1.1;
  return (
    <>
      <AuraGroundRings radius={radius} hovered={hovered} />
      <AuraLight offsetY={offsetY} hovered={hovered} />
    </>
  );
}

function AuraGroundRings({ radius, hovered }: { radius: number; hovered: boolean }): ReactElement {
  const discRef = useRef<Mesh>(null);
  const ringOuterRef = useRef<Mesh>(null);
  const ringInnerRef = useRef<Mesh>(null);

  useFrame((state, delta): void => {
    const t = state.clock.elapsedTime;
    const pulse = 0.7 + 0.3 * Math.sin(t * 1.8);
    if (ringOuterRef.current) ringOuterRef.current.rotation.z += delta * 0.3;
    if (ringInnerRef.current) ringInnerRef.current.rotation.z -= delta * 0.55;
    if (discRef.current) {
      const mat = discRef.current.material as MeshBasicMaterial;
      mat.opacity = pulse * (hovered ? 0.55 : 0.35);
    }
  });

  return (
    <>
      <group position={[0, AURA_GROUND_Y, 0]}>
        <mesh ref={discRef} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius, 64]} />
          <meshBasicMaterial color={AURA_COLOR_DISC} transparent opacity={0.4} depthWrite={false} side={DoubleSide} />
        </mesh>
        <mesh ref={ringOuterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, AURA_LAYER_GAP, 0]}>
          <ringGeometry args={[radius * 0.95, radius * 1.12, 64]} />
          <meshBasicMaterial color={AURA_COLOR_OUTER} transparent opacity={0.9} depthWrite={false} side={DoubleSide} />
        </mesh>
        <mesh ref={ringInnerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, AURA_LAYER_GAP * 2, 0]}>
          <ringGeometry args={[radius * 0.55, radius * 0.68, 48]} />
          <meshBasicMaterial color={AURA_COLOR_INNER} transparent opacity={0.75} depthWrite={false} side={DoubleSide} />
        </mesh>
      </group>
    </>
  );
}

function AuraLight({ offsetY, hovered }: { offsetY: number; hovered: boolean }): ReactElement {
  const lightRef = useRef<PointLight>(null);
  useFrame((state): void => {
    if (!lightRef.current) return;
    const pulse = 0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 1.8);
    lightRef.current.intensity = pulse * (hovered ? 4.0 : 2.6);
  });
  return (
    <pointLight
      ref={lightRef}
      color={AURA_COLOR_LIGHT}
      intensity={2.6}
      distance={8}
      position={[0, offsetY, 0]}
    />
  );
}

const APPEARANCE_COLOR_DISC = '#c084fc';
const APPEARANCE_COLOR_RING = '#a855f7';
const APPEARANCE_COLOR_LIGHT = '#e9d5ff';
const APPEARANCE_PARTICLE_COUNT = 4;
const APPEARANCE_PARTICLE_RADIUS = 0.05;

function AppearanceAura({ config, hovered }: { config: PoiCustomEffect; hovered: boolean }): ReactElement {
  const offsetY = config.offsetY ?? 0.08;
  const radius = config.radius ?? 1.15;
  return (
    <>
      <AppearanceGroundRing radius={radius} hovered={hovered} />
      <AppearanceLight offsetY={offsetY} hovered={hovered} />
      <AppearanceParticles orbitRadius={radius * 1.2} hovered={hovered} />
    </>
  );
}

function AppearanceGroundRing({ radius, hovered }: { radius: number; hovered: boolean }): ReactElement {
  const discRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  useFrame((state, delta): void => {
    const pulse = 0.6 + 0.4 * Math.sin(state.clock.elapsedTime * 1.4);
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.25;
    if (discRef.current) {
      const mat = discRef.current.material as MeshBasicMaterial;
      mat.opacity = pulse * (hovered ? 0.3 : 0.18);
    }
  });

  return (
    <group position={[0, AURA_GROUND_Y, 0]}>
      <mesh ref={discRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial color={APPEARANCE_COLOR_DISC} transparent opacity={0.2} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, AURA_LAYER_GAP, 0]}>
        <ringGeometry args={[radius * 0.92, radius * 1.06, 64]} />
        <meshBasicMaterial color={APPEARANCE_COLOR_RING} transparent opacity={0.7} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function AppearanceLight({ offsetY, hovered }: { offsetY: number; hovered: boolean }): ReactElement {
  const lightRef = useRef<PointLight>(null);
  useFrame((state): void => {
    if (!lightRef.current) return;
    const pulse = 0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 1.4);
    lightRef.current.intensity = pulse * (hovered ? 2.5 : 1.4);
  });
  return (
    <pointLight ref={lightRef} color={APPEARANCE_COLOR_LIGHT} intensity={1.4} distance={6} position={[0, offsetY, 0]} />
  );
}

function AppearanceParticles({ orbitRadius, hovered }: { orbitRadius: number; hovered: boolean }): ReactElement {
  const groupRef = useRef<Group>(null);

  useFrame((state): void => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    for (const [i, child] of group.children.entries()) {
      const phase = (i / APPEARANCE_PARTICLE_COUNT) * Math.PI * 2;
      const angle = t * 0.28 + phase;
      const r = orbitRadius + Math.sin(t * 0.8 + phase) * 0.12;
      child.position.x = Math.cos(angle) * r;
      child.position.y = 0.8 + Math.sin(t * 0.5 + phase) * 0.3;
      child.position.z = Math.sin(angle) * r;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: APPEARANCE_PARTICLE_COUNT }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[APPEARANCE_PARTICLE_RADIUS, 8, 8]} />
          <meshBasicMaterial color={APPEARANCE_COLOR_DISC} transparent opacity={hovered ? 0.9 : 0.65} />
        </mesh>
      ))}
    </group>
  );
}

const ROOMS_COLOR_DISC = '#4ade80';
const ROOMS_COLOR_RING = '#22c55e';
const ROOMS_COLOR_LIGHT = '#86efac';
const ROOMS_PARTICLE_COUNT = 4;
const ROOMS_PARTICLE_RADIUS = 0.045;

function RoomsAura({ config, hovered }: { config: PoiCustomEffect; hovered: boolean }): ReactElement {
  const offsetY = config.offsetY ?? 0.1;
  const radius = config.radius ?? 1.0;
  return (
    <>
      <RoomsGroundRing radius={radius} hovered={hovered} />
      <RoomsLight offsetY={offsetY} hovered={hovered} />
      <RoomsParticles orbitRadius={radius * 1.15} hovered={hovered} />
    </>
  );
}

function RoomsGroundRing({ radius, hovered }: { radius: number; hovered: boolean }): ReactElement {
  const discRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  useFrame((state, delta): void => {
    const pulse = 0.65 + 0.35 * Math.sin(state.clock.elapsedTime * 1.2);
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.2;
    if (discRef.current) {
      const mat = discRef.current.material as MeshBasicMaterial;
      mat.opacity = pulse * (hovered ? 0.28 : 0.15);
    }
  });

  return (
    <group position={[0, AURA_GROUND_Y, 0]}>
      <mesh ref={discRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial color={ROOMS_COLOR_DISC} transparent opacity={0.15} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, AURA_LAYER_GAP, 0]}>
        <ringGeometry args={[radius * 0.9, radius * 1.04, 64]} />
        <meshBasicMaterial color={ROOMS_COLOR_RING} transparent opacity={0.65} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function RoomsLight({ offsetY, hovered }: { offsetY: number; hovered: boolean }): ReactElement {
  const lightRef = useRef<PointLight>(null);
  useFrame((state): void => {
    if (!lightRef.current) return;
    const pulse = 0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 1.2);
    lightRef.current.intensity = pulse * (hovered ? 2.2 : 1.2);
  });
  return (
    <pointLight ref={lightRef} color={ROOMS_COLOR_LIGHT} intensity={1.2} distance={6} position={[0, offsetY, 0]} />
  );
}

function RoomsParticles({ orbitRadius, hovered }: { orbitRadius: number; hovered: boolean }): ReactElement {
  const groupRef = useRef<Group>(null);

  useFrame((state): void => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    for (const [i, child] of group.children.entries()) {
      const phase = (i / ROOMS_PARTICLE_COUNT) * Math.PI * 2;
      const angle = t * 0.22 + phase;
      const r = orbitRadius + Math.sin(t * 0.7 + phase) * 0.1;
      child.position.x = Math.cos(angle) * r;
      child.position.y = 0.6 + Math.sin(t * 0.45 + phase) * 0.25;
      child.position.z = Math.sin(angle) * r;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: ROOMS_PARTICLE_COUNT }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[ROOMS_PARTICLE_RADIUS, 8, 8]} />
          <meshBasicMaterial color={ROOMS_COLOR_DISC} transparent opacity={hovered ? 0.85 : 0.55} />
        </mesh>
      ))}
    </group>
  );
}

interface VisualsProps {
  color: string;
  hovered: boolean;
}

function PoiPlaceholderVisuals({ color, hovered }: VisualsProps): ReactElement {
  const crystalRef = useRef<Mesh>(null);

  useFrame((state, delta): void => {
    const crystal = crystalRef.current;
    if (!crystal) return;
    crystal.rotation.y += delta * CRYSTAL_SPIN_RATE;
    crystal.position.y = CRYSTAL_BASE_Y + Math.sin(state.clock.elapsedTime * CRYSTAL_BOB_FREQ) * CRYSTAL_BOB_AMP;
  });

  const ringIntensity = hovered ? 1.4 : 0.8;
  const glowOpacity = (hovered ? 0.9 : 0.4) * 0.4;
  const crystalIntensity = hovered ? 1.5 : 0.7;
  const crystalScale = hovered ? 1.15 : 1;
  const lightIntensity = hovered ? 0.9 : 0.45;

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <torusGeometry args={[GLOW_RING_RADIUS, GLOW_RING_TUBE, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={glowOpacity} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <torusGeometry args={[RING_RADIUS, RING_TUBE, 12, 64]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ringIntensity} />
      </mesh>
      <mesh ref={crystalRef} scale={crystalScale}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={crystalIntensity}
          transparent
          opacity={0.92}
          roughness={0.25}
        />
      </mesh>
      <pointLight color={color} intensity={lightIntensity} distance={4} position={[0, CRYSTAL_BASE_Y, 0]} />
    </>
  );
}

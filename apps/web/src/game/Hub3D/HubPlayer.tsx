import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type ReactElement, type Ref } from 'react';
import {
  ClampToEdgeWrapping,
  NearestFilter,
  SRGBColorSpace,
  SpriteMaterial,
  type Group,
  type Mesh,
  type Sprite,
  type Texture,
} from 'three';

import { useAuthStore } from '../../store/auth.store';
import { SKINS, type SkinConfig } from '../constants/skins';

import {
  PLAYER_BOB_LERP,
  PLAYER_HEIGHT,
  PLAYER_IDLE_BOB_AMP,
  PLAYER_IDLE_BOB_FREQ,
  PLAYER_IDLE_SCALE_AMP,
  PLAYER_ORIENTATION_THRESHOLD,
  PLAYER_RADIUS,
  PLAYER_SCALE,
  PLAYER_VERTICAL_OFFSET,
  PLAYER_WALK_BOB_AMP,
  PLAYER_WALK_BOB_FREQ,
  SHADOW_OPACITY,
  SHADOW_SCALE,
} from './constants';

type PlayerVisualState = 'idle' | 'walk';

const IDLE_FRAMES = 6;
const WALK_FRAMES = 8;
const ANIM_FPS = 10;
const SHADOW_LIFT = 0.005;
const SPRITE_CENTER_Y = PLAYER_VERTICAL_OFFSET;
const SHADOW_RADIUS = PLAYER_RADIUS * SHADOW_SCALE;
const HALO_INNER = SHADOW_RADIUS * 0.2;
const HALO_OUTER = SHADOW_RADIUS * 1.55;
const HALO_LIFT = SHADOW_LIFT + 0.002;
const MOVE_EPSILON_SQ = 1e-6;

interface HubPlayerProps {
  ref?: Ref<Group>;
  position?: readonly [number, number, number];
}

export function HubPlayer({ ref, position }: HubPlayerProps): ReactElement {
  const skinId = useAuthStore((state) => state.player?.skin);
  const skin = SKINS.find((entry) => entry.id === skinId) ?? null;

  return (
    <group ref={ref} position={position as [number, number, number] | undefined}>
      <ShadowDisc />
      <HaloDisc />
      {skin ? (
        <Suspense fallback={<PlaceholderCapsule />}>
          <AnimatedSpritePawn skin={skin} />
        </Suspense>
      ) : (
        <PlaceholderCapsule />
      )}
    </group>
  );
}

function ShadowDisc(): ReactElement {
  return (
    <mesh position={[0, SHADOW_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[SHADOW_RADIUS, 32]} />
      <meshBasicMaterial color="black" transparent opacity={SHADOW_OPACITY} depthWrite={false} />
    </mesh>
  );
}

function HaloDisc(): ReactElement {
  return (
    <mesh position={[0, HALO_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[HALO_INNER, HALO_OUTER, 48]} />
      <meshBasicMaterial color="#d4a96a" transparent opacity={0.10} depthWrite={false} />
    </mesh>
  );
}

function PlaceholderCapsule(): ReactElement {
  const meshRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);

  useFrame((_, delta): void => {
    if (!meshRef.current) return;
    phaseRef.current += delta * PLAYER_IDLE_BOB_FREQ * Math.PI * 2;
    meshRef.current.position.y = PLAYER_HEIGHT / 2 + PLAYER_IDLE_BOB_AMP * Math.sin(phaseRef.current);
  });

  const capsuleLength = Math.max(0.01, PLAYER_HEIGHT - 2 * PLAYER_RADIUS);
  return (
    <mesh ref={meshRef} castShadow position={[0, PLAYER_HEIGHT / 2, 0]}>
      <capsuleGeometry args={[PLAYER_RADIUS, capsuleLength, 4, 12]} />
      <meshStandardMaterial color="#4f8cff" roughness={0.55} metalness={0.1} />
    </mesh>
  );
}

function configureFrameTexture(tex: Texture, frames: number): void {
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.repeat.set(1 / frames, 1);
  tex.needsUpdate = true;
}

function buildTintedSpriteMaterial(initialMap: Texture, skin: SkinConfig): SpriteMaterial {
  const mat = new SpriteMaterial({ map: initialMap, transparent: true, alphaTest: 0.5 });
  const uHue = { value: (skin.hue * Math.PI) / 180 };
  const uSat = { value: skin.saturation };

  mat.onBeforeCompile = (shader): void => {
    shader.uniforms.uHue = uHue;
    shader.uniforms.uSat = uSat;
    shader.fragmentShader = `
      uniform float uHue;
      uniform float uSat;
      vec3 applyHue(vec3 rgb, float h) {
        const vec3 k = vec3(0.57735, 0.57735, 0.57735);
        float c = cos(h);
        return rgb * c + cross(k, rgb) * sin(h) + k * dot(k, rgb) * (1.0 - c);
      }
      vec3 applySat(vec3 rgb, float s) {
        float i = dot(rgb, vec3(0.299, 0.587, 0.114));
        return mix(vec3(i), rgb, s);
      }
      ${shader.fragmentShader}
    `.replace(
      '#include <map_fragment>',
      `
      #ifdef USE_MAP
        vec4 texelColor = texture2D(map, vMapUv);
        texelColor.rgb = applyHue(texelColor.rgb, uHue);
        texelColor.rgb = applySat(texelColor.rgb, uSat);
        diffuseColor *= texelColor;
      #endif
      `,
    );
  };
  mat.customProgramCacheKey = (): string => `hub-pawn-${skin.id}`;
  return mat;
}

interface MotionState {
  lastPosRef: React.MutableRefObject<{ x: number; z: number } | null>;
  facingRef: React.MutableRefObject<1 | -1>;
}

interface AnimState {
  frameRef: React.MutableRefObject<number>;
  timeRef: React.MutableRefObject<number>;
}

interface BobState {
  phaseRef: React.MutableRefObject<number>;
  ampRef: React.MutableRefObject<number>;
  freqRef: React.MutableRefObject<number>;
  scaleAmpRef: React.MutableRefObject<number>;
}

function readGroupMotion(group: { position: { x: number; z: number } }, motion: MotionState): { isMoving: boolean } {
  const px = group.position.x;
  const pz = group.position.z;
  const last = motion.lastPosRef.current;
  const dx = last ? px - last.x : 0;
  const dz = last ? pz - last.z : 0;
  motion.lastPosRef.current = { x: px, z: pz };
  if (Math.abs(dx) > PLAYER_ORIENTATION_THRESHOLD) {
    motion.facingRef.current = dx > 0 ? 1 : -1;
  }
  return { isMoving: dx * dx + dz * dz > MOVE_EPSILON_SQ };
}

function switchAnimTexture(material: SpriteMaterial, target: Texture, anim: AnimState): void {
  if (material.map === target) return;
  material.map = target;
  material.needsUpdate = true;
  anim.frameRef.current = 0;
  anim.timeRef.current = 0;
}

function advanceAnim(tex: Texture, frames: number, anim: AnimState, delta: number): void {
  anim.timeRef.current += delta * ANIM_FPS;
  while (anim.timeRef.current >= 1) {
    anim.frameRef.current = (anim.frameRef.current + 1) % frames;
    anim.timeRef.current -= 1;
  }
  tex.offset.x = anim.frameRef.current / frames;
}

interface BobContext {
  delta: number;
  facing: 1 | -1;
}

function applyBob(sprite: Sprite, bob: BobState, state: PlayerVisualState, ctx: BobContext): void {
  const targetAmp = state === 'walk' ? PLAYER_WALK_BOB_AMP : PLAYER_IDLE_BOB_AMP;
  const targetFreq = state === 'walk' ? PLAYER_WALK_BOB_FREQ : PLAYER_IDLE_BOB_FREQ;
  const targetScaleAmp = state === 'walk' ? 0 : PLAYER_IDLE_SCALE_AMP;
  const lerpT = Math.min(1, PLAYER_BOB_LERP * ctx.delta);
  bob.ampRef.current += (targetAmp - bob.ampRef.current) * lerpT;
  bob.freqRef.current += (targetFreq - bob.freqRef.current) * lerpT;
  bob.scaleAmpRef.current += (targetScaleAmp - bob.scaleAmpRef.current) * lerpT;
  bob.phaseRef.current += ctx.delta * bob.freqRef.current * Math.PI * 2;
  const sinVal = Math.sin(bob.phaseRef.current);
  sprite.position.y = SPRITE_CENTER_Y + bob.ampRef.current * sinVal;
  sprite.scale.x = PLAYER_SCALE * ctx.facing;
  sprite.scale.y = PLAYER_SCALE * (1 + bob.scaleAmpRef.current * sinVal);
}

function useSpriteMaterials(skin: SkinConfig): { idleTex: Texture; walkTex: Texture; material: SpriteMaterial } {
  const idleSrc = useTexture(`/assets/sprites/${skin.type}/idle.png`) as Texture;
  const walkSrc = useTexture(`/assets/sprites/${skin.type}/walk.png`) as Texture;
  const { idleTex, walkTex } = useMemo(() => {
    const idle = idleSrc.clone();
    const walk = walkSrc.clone();
    configureFrameTexture(idle, IDLE_FRAMES);
    configureFrameTexture(walk, WALK_FRAMES);
    return { idleTex: idle, walkTex: walk };
  }, [idleSrc, walkSrc]);
  const material = useMemo(() => buildTintedSpriteMaterial(idleTex, skin), [idleTex, skin]);
  useEffect(
    () => (): void => {
      material.dispose();
      idleTex.dispose();
      walkTex.dispose();
    },
    [material, idleTex, walkTex],
  );
  return { idleTex, walkTex, material };
}

function AnimatedSpritePawn({ skin }: { skin: SkinConfig }): ReactElement {
  const spriteRef = useRef<Sprite>(null);
  const { idleTex, walkTex, material } = useSpriteMaterials(skin);
  const motion: MotionState = {
    lastPosRef: useRef<{ x: number; z: number } | null>(null),
    facingRef: useRef<1 | -1>(1),
  };
  const anim: AnimState = {
    frameRef: useRef(0),
    timeRef: useRef(0),
  };
  const bob: BobState = {
    phaseRef: useRef(0),
    ampRef: useRef(PLAYER_IDLE_BOB_AMP),
    freqRef: useRef(PLAYER_IDLE_BOB_FREQ),
    scaleAmpRef: useRef(PLAYER_IDLE_SCALE_AMP),
  };

  useFrame((_, delta): void => {
    const sprite = spriteRef.current;
    const group = sprite?.parent;
    if (!sprite || !group) return;
    const { isMoving } = readGroupMotion(group, motion);
    const state: PlayerVisualState = isMoving ? 'walk' : 'idle';
    const tex = state === 'walk' ? walkTex : idleTex;
    switchAnimTexture(material, tex, anim);
    advanceAnim(tex, state === 'walk' ? WALK_FRAMES : IDLE_FRAMES, anim, delta);
    applyBob(sprite, bob, state, { delta, facing: motion.facingRef.current });
  });

  return (
    <sprite ref={spriteRef} position={[0, SPRITE_CENTER_Y, 0]} scale={[PLAYER_SCALE, PLAYER_SCALE, 1]}>
      <primitive object={material} attach="material" />
    </sprite>
  );
}

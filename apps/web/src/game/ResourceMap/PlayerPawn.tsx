import { useFBX, useTexture } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';

import type { PathNode, CombatPlayer } from '@game/shared-types';

import { getSkinById } from '../../game/constants/skins';
import { useAuthStore } from '../../store/auth.store';

const FARMING_MOVE_SPEED = 12.0;
const COMBAT_MOVE_SPEED = 4.5;
const FARMING_ANIM_SPEED = 18;
const COMBAT_ANIM_SPEED = 12;
const IDLE_FRAMES = 6;
const WALK_FRAMES = 8;
const ATTACK_FRAMES = 6;

interface PlayerPawnProps {
  gridPosition: PathNode;
  gridSize: number;
  path: PathNode[] | null;
  onPathComplete: () => void;
  playerData?: Partial<CombatPlayer> & { username?: string; playerId?: string };
  lookAtPosition?: PathNode | null;
  isJumping?: boolean;
  setPawnRef: (playerId: string, handle: PlayerPawnHandle | null) => void;
  onTileReached?: (node: PathNode) => void;
  mode?: 'combat' | 'farming';
}

export type PlayerPawnHandle = {
  triggerAttack: () => void;
};

function toWorld(gx: number, gy: number, gridSize: number): [number, number, number] {
  return [gx - gridSize / 2 + 0.5, 0, gy - gridSize / 2 + 0.5];
}

const MENHIR_URLS = [
  '/assets/models/Rock_1N.fbx',
  '/assets/models/Rock_1P.fbx',
  '/assets/models/Rock_1Q.fbx',
];
const MENHIR_TEXTURE = '/assets/models/forest_texture.png';
const MENHIR_GLOW = '#8b5cf6';

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

// One shared radial-gradient texture for every menhir halo (≈16KB on GPU, created once).
let haloTexture: THREE.CanvasTexture | null = null;
function getHaloTexture(): THREE.CanvasTexture {
  if (haloTexture) return haloTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(196,181,253,0.9)');
  g.addColorStop(0.4, 'rgba(139,92,246,0.35)');
  g.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  haloTexture = new THREE.CanvasTexture(canvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  return haloTexture;
}

function MenhirHalo({ seed }: { seed: number }): React.JSX.Element {
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const texture = useMemo(() => getHaloTexture(), []);

  useFrame((state) => {
    if (!matRef.current) return;
    const pulse = 0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 2 + seed);
    matRef.current.opacity = pulse;
  });

  return (
    <sprite position={[0, 0.55, 0]} scale={[1.7, 1.7, 1]}>
      <spriteMaterial
        ref={matRef}
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.8}
      />
    </sprite>
  );
}

const PARTICLE_COUNT = 10;

interface ParticleParam { radius: number; height: number; speed: number; phase: number; wobble: number; }

function MenhirParticles({ seed }: { seed: number }): React.JSX.Element {
  const pointsRef = useRef<THREE.Points>(null);

  const params = useMemo<ParticleParam[]>(() => {
    const out: ParticleParam[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = seed + i * 37;
      out.push({
        radius: 0.28 + seededRandom(s) * 0.22,
        height: 0.25 + seededRandom(s * 3) * 0.9,
        speed: 0.5 + seededRandom(s * 5) * 0.8,
        phase: seededRandom(s * 7) * Math.PI * 2,
        wobble: 0.08 + seededRandom(s * 11) * 0.14,
      });
    }
    return out;
  }, [seed]);

  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = params[i];
      const a = t * p.speed + p.phase;
      positions[i * 3] = Math.cos(a) * p.radius + Math.sin(t * 1.3 + p.phase) * p.wobble;
      positions[i * 3 + 1] = p.height + Math.sin(t * p.speed * 1.5 + p.phase) * 0.15;
      positions[i * 3 + 2] = Math.sin(a) * p.radius + Math.cos(t * 1.1 + p.phase) * p.wobble;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={1}
        color={MENHIR_GLOW}
        transparent
        opacity={0.95}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function MenhirModel({ seed }: { seed: number }): React.JSX.Element {
  const texture = useTexture(MENHIR_TEXTURE);
  const url = MENHIR_URLS[Math.floor(seededRandom(seed) * MENHIR_URLS.length)];
  const fbx = useFBX(url);

  const { object, offset, scale, rotationY } = useMemo(() => {
    const clone = fbx.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial;
        if ('map' in mat) {
          mat.map = texture;
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.color.setHex(0xffffff);
        }
        mat.roughness = 1.0;
        mat.metalness = 0.0;
        mat.emissive = new THREE.Color(MENHIR_GLOW);
        mat.emissiveIntensity = 0.3;
        mat.needsUpdate = true;
      }
    });

    const fit = 1.3 / Math.max(size.x, size.y, size.z);
    const rotationY = seededRandom(seed * 7) * Math.PI * 2;
    return {
      object: clone,
      offset: [-center.x, -box.min.y, -center.z] as [number, number, number],
      scale: fit,
      rotationY,
    };
  }, [fbx, texture, seed]);

  return (
    <group>
      <group scale={scale} rotation={[0, rotationY, 0]}>
        <primitive object={object} position={offset} />
      </group>
      <MenhirHalo seed={seed} />
      <MenhirParticles seed={seed} />
    </group>
  );
}

for (const url of MENHIR_URLS) useFBX.preload(url);
useTexture.preload(MENHIR_TEXTURE);

export const PlayerPawn = React.forwardRef<PlayerPawnHandle, PlayerPawnProps>(
  ({ gridPosition, gridSize, path, onPathComplete, playerData, lookAtPosition, isJumping, onTileReached, mode = 'farming' }, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const spriteRef = useRef<THREE.Sprite>(null);
    const { camera } = useThree();
    
    const [isMoving, setIsMoving] = useState(false);
    const [isAttacking, setIsAttacking] = useState(false);
    
    const [currentPath, setCurrentPath] = useState<PathNode[]>([]);
    const [pathIndex, setPathIndex] = useState(0);
    
    const progressRef = useRef(0);
    const animFrameRef = useRef(0);
    const frameCounterRef = useRef(0);
    const materialRef = useRef<THREE.SpriteMaterial | null>(null);
    const textureClonesRef = useRef<THREE.Texture[]>([]);

    const fromRef = useRef<[number, number, number]>(toWorld(gridPosition.x, gridPosition.y, gridSize));
    const toRef = useRef<[number, number, number]>(toWorld(gridPosition.x, gridPosition.y, gridSize));

    const skinConfig = useMemo(() => {
      if (playerData?.skin === 'menhir') return { id: 'menhir', name: 'Menhir', type: 'menhir', hue: 0, saturation: 1 };
      return getSkinById(playerData?.skin || 'soldier-classic');
    }, [playerData?.skin]);

    const spriteType = skinConfig.type;
    const isSummon = playerData?.type === 'SUMMON';

    // Charger et isoler les textures (Seulement si ce n'est pas une invocation sans sprites)
    const skipSprites = isSummon && spriteType === 'menhir';
    
    // On utilise un try/catch ou un fallback pour le loader en React-Three-Fiber est complexe, 
    // on va plutôt utiliser des chemins valides (soldier par défaut) si on skip.
    const pathPrefix = skipSprites ? 'soldier' : spriteType;
    const texIdle = useLoader(THREE.TextureLoader, `/assets/sprites/${pathPrefix}/idle.png`);
    const texWalk = useLoader(THREE.TextureLoader, `/assets/sprites/${pathPrefix}/walk.png`);
    const texAttack = useLoader(THREE.TextureLoader, `/assets/sprites/${pathPrefix}/attack.png`);

    const { textureIdle, textureWalk, textureAttack } = useMemo(() => {
      if (skipSprites) return { textureIdle: texIdle, textureWalk: texWalk, textureAttack: texAttack };
      const tIdle = texIdle.clone();
      const tWalk = texWalk.clone();
      const tAttack = texAttack.clone();
      textureClonesRef.current = [tIdle, tWalk, tAttack];
      
      // Config Idle (6 frames)
      tIdle.magFilter = tIdle.minFilter = THREE.NearestFilter;
      tIdle.generateMipmaps = false;
      tIdle.colorSpace = THREE.SRGBColorSpace;
      tIdle.wrapS = tIdle.wrapT = THREE.ClampToEdgeWrapping;
      tIdle.repeat.set(1 / IDLE_FRAMES, 1);
      
      // Config Walk (8 frames)
      tWalk.magFilter = tWalk.minFilter = THREE.NearestFilter;
      tWalk.generateMipmaps = false;
      tWalk.colorSpace = THREE.SRGBColorSpace;
      tWalk.wrapS = tWalk.wrapT = THREE.ClampToEdgeWrapping;
      tWalk.repeat.set(1 / WALK_FRAMES, 1);

      // Config Attack (6 frames)
      tAttack.magFilter = tAttack.minFilter = THREE.NearestFilter;
      tAttack.generateMipmaps = false;
      tAttack.colorSpace = THREE.SRGBColorSpace;
      tAttack.wrapS = tAttack.wrapT = THREE.ClampToEdgeWrapping;
      tAttack.repeat.set(1 / ATTACK_FRAMES, 1);
      
      tIdle.needsUpdate = true;
      tWalk.needsUpdate = true;
      tAttack.needsUpdate = true;
      
      return { textureIdle: tIdle, textureWalk: tWalk, textureAttack: tAttack };
    }, [texIdle, texWalk, texAttack, skipSprites]);

    // Uniforms pour le shader de couleur
    const uniforms = useMemo(() => ({
        uHue: { value: (skinConfig.hue * Math.PI) / 180 },
        uSat: { value: skinConfig.saturation }
    }), [skinConfig]);

    // Memoïser le matériau pour éviter les fuites WebGL et les recompilations massives
    const spriteMaterial = useMemo(() => {
        const mat = new THREE.SpriteMaterial({
            map: textureIdle,
            transparent: true,
            alphaTest: 0.5,
            precision: 'highp',
        });
        
        mat.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
            shader.uniforms.uHue = uniforms.uHue;
            shader.uniforms.uSat = uniforms.uSat;

            shader.fragmentShader = `
                uniform float uHue;
                uniform float uSat;
                vec3 applyHue(vec3 rgb, float hueOffset) {
                    const vec3 k = vec3(0.57735, 0.57735, 0.57735);
                    float cosAngle = cos(hueOffset);
                    return rgb * cosAngle + cross(k, rgb) * sin(hueOffset) + k * dot(k, rgb) * (1.0 - cosAngle);
                }
                vec3 applySat(vec3 rgb, float sat) {
                    float intensity = dot(rgb, vec3(0.299, 0.587, 0.114));
                    return mix(vec3(intensity), rgb, sat);
                }
                ${shader.fragmentShader}
            `.replace(
                '#include <map_fragment>',
                `
                #ifdef USE_MAP
                    vec4 texelColor = texture2D( map, vMapUv );
                    texelColor.rgb = applyHue(texelColor.rgb, uHue);
                    texelColor.rgb = applySat(texelColor.rgb, uSat);
                    diffuseColor *= texelColor;
                #endif
                `
            );
        };
        mat.customProgramCacheKey = () => `pawn-mat-${skinConfig.id}`;
        return mat;
    }, [textureIdle, skinConfig.id, uniforms]);

    useEffect(() => {
      const prev = materialRef.current;
      materialRef.current = spriteMaterial;
      return () => {
        prev?.dispose();
        if (prev) {
          for (const t of textureClonesRef.current) t.dispose();
          textureClonesRef.current = [];
        }
      };
    }, [spriteMaterial]);



    // Update du map du mat en fonction de l'état (marche/attaque)
    useEffect(() => {
        if (isAttacking) spriteMaterial.map = textureAttack;
        else if (isMoving) spriteMaterial.map = textureWalk;
        else spriteMaterial.map = textureIdle;
        spriteMaterial.needsUpdate = true;
    }, [isAttacking, isMoving, textureIdle, textureWalk, textureAttack, spriteMaterial]);

    // Exposer triggerAttack
    React.useImperativeHandle(ref, () => ({
      triggerAttack: () => {
        setIsAttacking(true);
        animFrameRef.current = 0;
        frameCounterRef.current = 0;
      }
    }));

    useEffect(() => {
      if (path && path.length > 0) {
        const myWorld = groupRef.current 
            ? [groupRef.current.position.x, 0, groupRef.current.position.z] as [number, number, number]
            : toWorld(gridPosition.x, gridPosition.y, gridSize);

        setCurrentPath(path);
        setIsMoving(true);
        progressRef.current = 0;
        fromRef.current = myWorld;

        // Chercher la première vraie destination (différente du point actuel)
        let nextIdx = 0;
        while(nextIdx < path.length) {
            const pt = toWorld(path[nextIdx].x, path[nextIdx].y, gridSize);
            const dSquare = (pt[0]-myWorld[0])**2 + (pt[2]-myWorld[2])**2;
            if (dSquare > 0.01) break; // Assez loin
            nextIdx++;
        }

        if (nextIdx < path.length) {
            setPathIndex(nextIdx);
            toRef.current = toWorld(path[nextIdx].x, path[nextIdx].y, gridSize);
        } else {
            setIsMoving(false);
            setPathIndex(0);
        }
      }
    // gridPosition intentionally omitted: it's only a fallback when groupRef is null (pre-mount),
    // and including it caused the animation to restart on every movePlayer() call mid-path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path, gridSize]);

    useFrame((state, delta) => {
      // 1. Animation stable
      let frames = IDLE_FRAMES;
      let activeTex = textureIdle;

      if (isAttacking) {
        frames = ATTACK_FRAMES;
        activeTex = textureAttack;
      } else if (isMoving) {
        frames = WALK_FRAMES;
        activeTex = textureWalk;
      }

          const currentAnimSpeed = mode === 'farming' ? FARMING_ANIM_SPEED : COMBAT_ANIM_SPEED;
          frameCounterRef.current += delta * (isAttacking ? currentAnimSpeed * 0.8 : currentAnimSpeed);
          if (frameCounterRef.current >= 1) {
             if (isAttacking) {
                animFrameRef.current++;
                if (animFrameRef.current >= frames) {
                    setIsAttacking(false);
                    animFrameRef.current = 0;
                }
             } else {
                animFrameRef.current = (animFrameRef.current + 1) % frames;
             }
             frameCounterRef.current = 0;
             
             if (spriteRef.current) {
                spriteRef.current.material.map = activeTex;
                activeTex.offset.x = animFrameRef.current / frames;
             }
          }

      // 2. Déplacement souple
      if (!isMoving || !groupRef.current || currentPath.length === 0) {
          if (!isMoving && groupRef.current) {
              const targetPos = toWorld(gridPosition.x, gridPosition.y, gridSize);
              groupRef.current.position.lerp(new THREE.Vector3(targetPos[0], 0, targetPos[2]), 0.1);
          }
      } else {
          const currentMoveSpeed = mode === 'farming' ? FARMING_MOVE_SPEED : COMBAT_MOVE_SPEED;
          const nextSpeed = isJumping ? currentMoveSpeed * 1.5 : currentMoveSpeed;
          progressRef.current += delta * nextSpeed;
          const t = Math.min(progressRef.current, 1);
          const x = THREE.MathUtils.lerp(fromRef.current[0], toRef.current[0], t);
          const z = THREE.MathUtils.lerp(fromRef.current[2], toRef.current[2], t);
          
          // Arc de saut si besoin
          let y = 0;
          if (isJumping) {
            y = Math.sin(t * Math.PI) * 3.5;
          }

          groupRef.current.position.set(x, y, z);
          if (t >= 1) {
            const nextIndex = pathIndex + 1;
            if (nextIndex < currentPath.length) {
              groupRef.current.position.set(toRef.current[0], 0, toRef.current[2]);
              onTileReached?.(currentPath[pathIndex]);
              fromRef.current = [...toRef.current];
              toRef.current = toWorld(currentPath[nextIndex].x, currentPath[nextIndex].y, gridSize);
              setPathIndex(nextIndex);
              progressRef.current = 0;
            } else {
              groupRef.current.position.set(toRef.current[0], 0, toRef.current[2]);
              onTileReached?.(currentPath[pathIndex]);
              setIsMoving(false);
              setCurrentPath([]);
              setPathIndex(0);
              onPathComplete();
            }
          }
      }

      // 3. Orientation dynamique (Face-à-Face)
      if (groupRef.current && camera) {
          const myPos = new THREE.Vector3().setFromMatrixPosition(groupRef.current.matrixWorld);
          const myScreen = myPos.clone().project(camera);

          // Cible (adversaire ou centre si solo)
          let targetX = 0; 
          if (lookAtPosition) {
             const targetWorld = toWorld(lookAtPosition.x, lookAtPosition.y, gridSize);
             const targetScreen = new THREE.Vector3(targetWorld[0], 0, targetWorld[2]).project(camera);
             targetX = targetScreen.x;
          }

          const isTargetAtRight = targetX > myScreen.x;
          const isOrc = spriteType === 'orc';
          
          // L'orc regarde par défaut à gauche, le guerrier à droite
          const finalFlip = isOrc ? isTargetAtRight : !isTargetAtRight;
          if (spriteRef.current) {
            spriteRef.current.scale.x = finalFlip ? -6.0 : 6.0;
          }
      }
    });

    const currentUser = useAuthStore((s) => s.player);
    const isEnemy = useMemo(() => {
      if (!currentUser || !playerData) return true;
      const uid = currentUser.id || (currentUser as { _id?: string })._id;
      const ownerId = playerData.casterId || playerData.playerId;
      return ownerId !== uid;
    }, [currentUser, playerData]);

    const initialWorld = toWorld(gridPosition.x, gridPosition.y, gridSize);

    return (
      <group 
        ref={groupRef} 
        position={initialWorld}
      >
        {/* HITBOX invisible (laissée pour d'autres clics éventuels) */}
        <mesh 
          visible={false} 
          position={[0, 0.5, 0]}
          userData={{ type: 'player-pawn', playerId: playerData?.playerId }}
        >
            <boxGeometry args={[1, 1.5, 1]} />
        </mesh>

        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.45, 16]} />
          <meshBasicMaterial color="black" transparent opacity={0.5} />
        </mesh>

        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.44, 24]} />
          <meshBasicMaterial color={isEnemy ? '#ef4444' : '#3b82f6'} transparent opacity={0.85} />
        </mesh>

        {isSummon && spriteType === 'menhir' ? (
          <MenhirModel seed={hashString(playerData?.playerId ?? skinConfig.id)} />
        ) : (
          <sprite 
            ref={spriteRef} 
            position={[0, 0.45, 0]} 
            scale={[6, 6, 1]}
          >
            <primitive 
                object={spriteMaterial} 
                attach="material" 
                key={`${skinConfig.id}-${spriteType}`}
            />
          </sprite>
        )}

        {/* BARRE DE VIE retirée pour farming */}
      </group>
    );
  }
);

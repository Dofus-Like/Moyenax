import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Billboard, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { PathNode, CombatPlayer } from '@game/shared-types';
import { getSkinById } from '../../game/constants/skins';
import { useAuthStore } from '../../store/auth.store';
import { useCombatStore } from '../../store/combat.store';

const MOVE_SPEED = 4.5;
const ANIM_SPEED = 12;
const IDLE_FRAMES = 6;
const WALK_FRAMES = 8;
const ATTACK_FRAMES = 6;

interface PlayerPawnProps {
  gridPosition: PathNode;
  gridSize: number;
  path: PathNode[] | null;
  onPathComplete: () => void;
  playerData?: CombatPlayer;
  lookAtPosition?: PathNode | null;
  isJumping?: boolean;
}

export type PlayerPawnHandle = {
  triggerAttack: () => void;
};

function toWorld(gx: number, gy: number, gridSize: number): [number, number, number] {
  return [gx - gridSize / 2 + 0.5, 0, gy - gridSize / 2 + 0.5];
}

export const PlayerPawn = React.forwardRef<PlayerPawnHandle, PlayerPawnProps>(
  ({ gridPosition, gridSize, path, onPathComplete, playerData, lookAtPosition, isJumping }, ref) => {
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

    const fromRef = useRef<[number, number, number]>(toWorld(gridPosition.x, gridPosition.y, gridSize));
    const toRef = useRef<[number, number, number]>(toWorld(gridPosition.x, gridPosition.y, gridSize));

    const skinConfig = useMemo(() => {
      return getSkinById(playerData?.skin || 'soldier-classic');
    }, [playerData?.skin]);

    const spriteType = skinConfig.type;

    // Charger et isoler les textures
    const texIdle = useLoader(THREE.TextureLoader, `/assets/sprites/${spriteType}/idle.png`);
    const texWalk = useLoader(THREE.TextureLoader, `/assets/sprites/${spriteType}/walk.png`);
    const texAttack = useLoader(THREE.TextureLoader, `/assets/sprites/${spriteType}/attack.png`);

    const { textureIdle, textureWalk, textureAttack } = useMemo(() => {
      const tIdle = texIdle.clone();
      const tWalk = texWalk.clone();
      const tAttack = texAttack.clone();
      
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
    }, [texIdle, texWalk, texAttack]);

    // Uniforms pour le shader de couleur
    const uniforms = useMemo(() => ({
        uHue: { value: (skinConfig.hue * Math.PI) / 180 },
        uSat: { value: skinConfig.saturation }
    }), [skinConfig]);

    useEffect(() => {
        uniforms.uHue.value = (skinConfig.hue * Math.PI) / 180;
        uniforms.uSat.value = skinConfig.saturation;
    }, [skinConfig, uniforms]);

    const handleBeforeCompile = (shader: any) => {
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
    }, [path]);

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

      frameCounterRef.current += delta * (isAttacking ? ANIM_SPEED * 0.8 : ANIM_SPEED);
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
          const nextSpeed = isJumping ? MOVE_SPEED * 1.5 : MOVE_SPEED;
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
              fromRef.current = [...toRef.current];
              toRef.current = toWorld(currentPath[nextIndex].x, currentPath[nextIndex].y, gridSize);
              setPathIndex(nextIndex);
              progressRef.current = 0;
            } else {
              groupRef.current.position.set(toRef.current[0], 0, toRef.current[2]);
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
    const showEnemyHp = useCombatStore((s) => s.showEnemyHp);
    const [isHovered, setIsHovered] = useState(false);
    const initialWorld = toWorld(gridPosition.x, gridPosition.y, gridSize);

    const isEnemy = useMemo(() => {
      if (!currentUser || !playerData) return true;
      const uid = currentUser.id || (currentUser as any)._id;
      return playerData.playerId !== uid;
    }, [currentUser, playerData]);

    // Calcul de la vie pour la barre
    const hpPercent = useMemo(() => {
        if (!playerData || !playerData.stats.vit) return 1;
        return Math.max(0, Math.min(1, playerData.currentVit / playerData.stats.vit));
    }, [playerData]);

    return (
      <group 
        ref={groupRef} 
        position={initialWorld}
      >
        {/* HITBOX invisible (laissée pour d'autres clics éventuels) */}
        <mesh visible={false} position={[0, 0.5, 0]}>
            <boxGeometry args={[1, 1.5, 1]} />
        </mesh>

        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.45, 16]} />
          <meshBasicMaterial color="black" transparent opacity={0.5} />
        </mesh>

        <sprite 
          ref={spriteRef} 
          position={[0, 0.45, 0]} 
          scale={[6, 6, 1]}
        >
          <spriteMaterial 
              map={textureIdle} 
              transparent={true} 
              alphaTest={0.5}
              precision="highp"
              onBeforeCompile={handleBeforeCompile}
              key={`${skinConfig.id}-${spriteType}`}
          />
        </sprite>

        {/* BARRE DE VIE (Contrôlée par l'option globale) */}
        {showEnemyHp && isEnemy && playerData && (
          <Billboard position={[0, 1.4, 0]}>
            {/* Outline Arrondi (Tracé fin) */}
            <RoundedBox args={[1.54, 0.18, 0.01]} radius={0.09} smoothness={4}>
              <meshBasicMaterial color="white" transparent opacity={0.15} />
            </RoundedBox>

            {/* Fond Arrondi (Pill shape) */}
            <RoundedBox position={[0, 0, 0.01]} args={[1.5, 0.16, 0.01]} radius={0.08} smoothness={4}>
              <meshBasicMaterial color="#0f172a" />
            </RoundedBox>

            {/* Fill (Contenu) */}
            {hpPercent > 0 && (
              <mesh position={[-(1.5 * (1 - hpPercent)) / 2, 0, 0.02]}>
                <planeGeometry args={[1.5 * hpPercent, 0.14]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            )}

            {/* Texte PV précis (Format large restauré) */}
            <Text
              position={[0, 0, 0.03]}
              fontSize={0.2}
              color="white"
              anchorX="center"
              anchorY="middle"
              fontWeight="900"
              outlineWidth={0.025}
              outlineColor="black"
            >
              {`${Math.ceil(playerData.currentVit)} / ${playerData.stats.vit} PV`}
            </Text>
          </Billboard>
        )}
      </group>
    );
  }
);

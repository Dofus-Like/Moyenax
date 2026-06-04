import { TerrainType } from '@game/shared-types';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { type RefObject, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { PortraitPawn } from '../../components/PortraitPawn';
import { TERRAIN_COLORS } from '../ResourceMap/TerrainTile';
import { SpellVFX } from '../UnifiedMap/overlays/SpellVFX';

// Hauteur d'entité fixe (unités monde) ; distance caméra calculée depuis le FOV pour
// cadrer l'entité de façon constante quelle que soit la carte.
export const ENTITY_HEIGHT = 1.8;
export const CAM_FOV = 35;
export const CAM_DIST = (ENTITY_HEIGHT * 2.1) / (2 * Math.tan((CAM_FOV * Math.PI) / 360));

function EnvModel({
  url,
  targetSize,
  onReady,
}: {
  url: string;
  targetSize: number;
  onReady: () => void;
}) {
  const { scene } = useGLTF(url);
  const { node, scale } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.set(-center.x, -box.min.y, -center.z);
    return { node: clone, scale: targetSize / (Math.max(size.x, size.z) || 1) };
  }, [scene, targetSize]);
  useEffect(() => onReady(), [node, onReady]);
  return (
    <group scale={scale}>
      <primitive object={node} />
    </group>
  );
}

function FlatGround({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[14, 14]} />
      <meshStandardMaterial color={TERRAIN_COLORS[TerrainType.GROUND].base} />
    </mesh>
  );
}

// Pose l'entité sur le sol (raycast vers le bas, dernier impact = sol même sous un
// dôme) et cadre la caméra dessus (third-person), comme un vrai jeu.
function useGroundedCamera(envRef: RefObject<THREE.Group | null>) {
  const { camera } = useThree();
  const [groundY, setGroundY] = useState(0);

  const handleReady = useCallback(() => {
    const env = envRef.current;
    if (!env) return;
    env.updateWorldMatrix(true, true);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(0, 80, 0),
      new THREE.Vector3(0, -1, 0),
      0,
      300,
    );
    const hits = ray.intersectObject(env, true);
    setGroundY(hits.length > 0 ? hits[hits.length - 1].point.y : 0);
  }, [envRef]);

  useEffect(() => {
    camera.position.set(0, groundY + ENTITY_HEIGHT * 1.05, CAM_DIST);
    camera.lookAt(0, groundY + ENTITY_HEIGHT * 0.5, 0);
  }, [camera, groundY]);

  return { groundY, handleReady };
}

interface CastSceneProps {
  skinId: string;
  attacking: boolean;
  playing: boolean;
  vfxType: string | null;
  runId: number;
  groundUrl?: string;
  groundTargetSize?: number;
  onVfxEnd: () => void;
  onCastEnd: () => void;
}

/**
 * Scène de cast partagée (Spell Lab + Intégration) : entité posée au sol qui joue son
 * animation d'attaque au lancer, plus le projectile (depuis l'entité vers un ennemi
 * invisible) quand le sort est de type PROJECTILE.
 */
export function CastScene(props: CastSceneProps) {
  const {
    skinId,
    attacking,
    playing,
    vfxType,
    runId,
    groundUrl,
    groundTargetSize = 14,
    onVfxEnd,
    onCastEnd,
  } = props;
  const envRef = useRef<THREE.Group>(null);
  const { groundY, handleReady } = useGroundedCamera(envRef);

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 9, 6]} intensity={1.1} castShadow />
      <Suspense fallback={null}>
        <group ref={envRef}>
          {groundUrl ? (
            <EnvModel url={groundUrl} targetSize={groundTargetSize} onReady={handleReady} />
          ) : (
            <FlatGround onReady={handleReady} />
          )}
        </group>
        <group position={[0, groundY + ENTITY_HEIGHT / 2, 0]} scale={ENTITY_HEIGHT}>
          <PortraitPawn skinId={skinId} isAttacking={attacking} onAttackComplete={onCastEnd} />
        </group>
        {playing && vfxType && (
          // Le projectile part de l'entité (x=4.5) vers un ennemi invisible (x=8), à
          // hauteur de torse (le tir est codé à y=0.8 dans SpellVFX).
          <group position={[0, groundY + ENTITY_HEIGHT * 0.55 - 0.8, 0]}>
            <SpellVFX
              key={runId}
              type={vfxType}
              from={{ x: 4.5, y: 4.5 }}
              to={{ x: 8, y: 4.5 }}
              onComplete={onVfxEnd}
            />
          </group>
        )}
      </Suspense>
    </>
  );
}

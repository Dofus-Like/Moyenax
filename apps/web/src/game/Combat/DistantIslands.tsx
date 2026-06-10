import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls, folder } from 'leva';
import { type JSX, useMemo, useRef } from 'react';
import * as THREE from 'three';

import stripUrl from '../../assets/textures/distant_islands_strip.png';
import { createSceneMetricRecorder, isSceneDebugEnabled } from '../../perf/scene-metric-recorder';

const STRIP_ASPECT = 512 / 4096; // hauteur / largeur de la texture

/**
 * Bande d'îles lointaines à l'horizon : un cylindre texturé centré sur la caméra
 * (backdrop type skybox). Le tiling fait que chaque direction montre des îles
 * différentes ; la transparence de la texture ne laisse voir que les silhouettes.
 */
export function DistantIslands(): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const strip = useTexture(stripUrl);
  const recordFollowCamera = useMemo(
    () => createSceneMetricRecorder('DistantIslands:follow-camera', 1),
    [],
  );

  const config = useControls('Îles lointaines', {
    Horizon: folder({
      visible: true,
      radius: { value: 250, min: 120, max: 700, label: 'Distance' },
      repeat: { value: 5, min: 1, max: 12, step: 1, label: 'Répétitions' },
      horizonY: { value: -2.5, min: -40, max: 15, label: 'Niveau horizon' },
      opacity: { value: 1, min: 0, max: 1 },
    }),
  });

  useMemo(() => {
    strip.wrapS = THREE.RepeatWrapping;
    strip.wrapT = THREE.ClampToEdgeWrapping;
    strip.colorSpace = THREE.SRGBColorSpace;
    strip.anisotropy = 4;
  }, [strip]);

  strip.repeat.set(config.repeat, 1);

  // Hauteur du cylindre calculée pour préserver le ratio de la texture (pas de déformation).
  const height = useMemo(
    () => ((2 * Math.PI * config.radius) / config.repeat) * STRIP_ASPECT,
    [config.radius, config.repeat],
  );

  useFrame(() => {
    const startedAt = isSceneDebugEnabled() ? performance.now() : 0;
    const g = groupRef.current;
    if (!g) return;
    // Suit la caméra en XZ, mais reste ancrée au niveau de la mer (Y monde fixe)
    // → la ligne d'eau des îles se pose pile sur l'horizon, sans trou.
    g.position.set(camera.position.x, config.horizonY, camera.position.z);
    if (startedAt > 0) recordFollowCamera(performance.now() - startedAt);
  });

  return (
    <group ref={groupRef} visible={config.visible}>
      <mesh renderOrder={-950}>
        <cylinderGeometry args={[config.radius, config.radius, height, 96, 1, true]} />
        <meshBasicMaterial
          map={strip}
          side={THREE.BackSide}
          transparent
          opacity={config.opacity}
          depthWrite={false}
          alphaTest={0.06}
          fog={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

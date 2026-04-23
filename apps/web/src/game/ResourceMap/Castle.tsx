import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useControls, button, folder } from 'leva';
import * as THREE from 'three';
import { COMBAT_COLORS } from '../constants/colors';

interface CastleProps {
  position: [number, number, number];
  targetSize?: number;
  rotation?: [number, number, number];
}

export function Castle({ position, targetSize, rotation = [0, 0, 0] }: CastleProps) {
  const { scene } = useGLTF('/assets/models/castle_ruin.glb');

  const { clonedScene, scaleFactor, offset, materials } = useMemo(() => {
    const clone = scene.clone(true);

    // Calculate bounding box to determine intrinsic size
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.z);
    const factor = targetSize ? targetSize / maxDim : 1;

    // On centre en X/Z mais on aligne le HAUT du modèle à Y=0
    const center = new THREE.Vector3();
    box.getCenter(center);
    const topY = box.max.y;

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return {
      clonedScene: clone,
      scaleFactor: factor,
      offset: new THREE.Vector3(-center.x, -topY, -center.z),
      materials: Array.from(
        new Set(
          clone.children.flatMap((c) => {
            const ms: THREE.Material[] = [];
            c.traverse((node) => {
              if ((node as THREE.Mesh).isMesh) {
                const m = (node as THREE.Mesh).material;
                if (Array.isArray(m)) ms.push(...m);
                else ms.push(m);
              }
            });
            return ms;
          }),
        ),
      ) as THREE.MeshStandardMaterial[],
    };
  }, [scene, targetSize]);

  // Sync with background shader's time of day
  const config = useControls(
    'Background Shader',
    {
      timeOfDay: { value: 0, min: 0, max: 2, step: 1 },
      'Castle Colors': folder({
        castleDay: { value: COMBAT_COLORS.CASTLE_DAY },
        castleSun: { value: COMBAT_COLORS.CASTLE_SUN },
        castleNight: { value: COMBAT_COLORS.CASTLE_NIGHT },
        castleEmissiveSun: { value: COMBAT_COLORS.CASTLE_EMISSIVE_SUN },
        castleEmissiveNight: { value: COMBAT_COLORS.CASTLE_EMISSIVE_NIGHT },
        castleEmissiveIntensity: { value: COMBAT_COLORS.CASTLE_EMISSIVE_INTENSITY, min: 0, max: 2 },
      }),
      'Log Castle for AI': button((get) => {
        const castleConfig = {
          castleDay: get('Background Shader.Castle Colors.castleDay'),
          castleSun: get('Background Shader.Castle Colors.castleSun'),
          castleNight: get('Background Shader.Castle Colors.castleNight'),
          castleEmissiveSun: get('Background Shader.Castle Colors.castleEmissiveSun'),
          castleEmissiveNight: get('Background Shader.Castle Colors.castleEmissiveNight'),
          castleEmissiveIntensity: get('Background Shader.Castle Colors.castleEmissiveIntensity'),
        };
        console.log('--- CASTLE CONFIG ---');
        console.log(JSON.stringify(castleConfig, null, 2));
      }),
    },
    { collapsed: true },
  );

  useFrame(() => {
    // Phase 0: Day, 1: Sunset, 2: Night
    const dayColor = new THREE.Color(config.castleDay);
    const sunColor = new THREE.Color(config.castleSun);
    const nightColor = new THREE.Color(config.castleNight);

    const targetColor = new THREE.Color();
    const targetEmissive = new THREE.Color();
    let intensity = 0;

    if (config.timeOfDay <= 1) {
      // Day to Sunset
      const t = config.timeOfDay;
      targetColor.lerpColors(dayColor, sunColor, t);
      targetEmissive.set(config.castleEmissiveSun);
      intensity = t * config.castleEmissiveIntensity;
    } else {
      // Sunset to Night
      const t = config.timeOfDay - 1;
      targetColor.lerpColors(sunColor, nightColor, t);
      targetEmissive.lerpColors(
        new THREE.Color(config.castleEmissiveSun),
        new THREE.Color(config.castleEmissiveNight),
        t,
      );
      intensity = config.castleEmissiveIntensity;
    }

    materials.forEach((m) => {
      if (m.isMeshStandardMaterial) {
        m.color.copy(targetColor);
        m.emissive.copy(targetEmissive);
        m.emissiveIntensity = intensity;
      }
    });
  });

  return (
    <group position={position} rotation={rotation} scale={scaleFactor}>
      <primitive object={clonedScene} position={[offset.x, offset.y, offset.z]} />
    </group>
  );
}

useGLTF.preload('/assets/models/castle_ruin.glb');

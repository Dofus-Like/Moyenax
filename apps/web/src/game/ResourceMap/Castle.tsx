import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useControls, button, folder } from 'leva';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { COMBAT_COLORS } from '../constants/colors';

interface CastleProps {
  position: [number, number, number];
  targetSize?: number;
  rotation?: [number, number, number];
  timeOfDay?: number;
}

export function Castle({ position, targetSize, rotation = [0, 0, 0], timeOfDay = 0 }: CastleProps) {
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
      materials: Array.from(new Set(clone.children.flatMap(c => {
        const ms: THREE.Material[] = [];
        c.traverse(node => {
          if ((node as THREE.Mesh).isMesh) {
            const m = (node as THREE.Mesh).material;
            if (Array.isArray(m)) ms.push(...m);
            else ms.push(m);
          }
        });
        return ms;
      }))) as THREE.MeshStandardMaterial[]
    };
  }, [scene, targetSize]);

  const config = useControls('Background Shader', {
    'Castle Colors': folder({
      castleDay: { value: COMBAT_COLORS.CASTLE_DAY },
      castleSun: { value: COMBAT_COLORS.CASTLE_SUN },
      castleNight: { value: COMBAT_COLORS.CASTLE_NIGHT },
      castleEmissiveSun: { value: COMBAT_COLORS.CASTLE_EMISSIVE_SUN },
      castleEmissiveNight: { value: COMBAT_COLORS.CASTLE_EMISSIVE_NIGHT },
      castleEmissiveIntensity: { value: COMBAT_COLORS.CASTLE_EMISSIVE_INTENSITY, min: 0, max: 2 },
    }),
    'Log Castle for AI': button((_get) => {
      // Debug button - intentionally unused for now
    }),
  }, { collapsed: true });

  const colorCache = useRef({
    dayColor: new THREE.Color(),
    sunColor: new THREE.Color(),
    nightColor: new THREE.Color(),
    targetColor: new THREE.Color(),
    targetEmissive: new THREE.Color(),
    emissiveSun: new THREE.Color(),
    emissiveNight: new THREE.Color(),
  });

  useFrame(() => {
    const c = colorCache.current;
    c.dayColor.set(config.castleDay);
    c.sunColor.set(config.castleSun);
    c.nightColor.set(config.castleNight);

    let intensity = 0;

    if (timeOfDay <= 1) {
      const t = timeOfDay;
      c.targetColor.lerpColors(c.dayColor, c.sunColor, t);
      c.targetEmissive.set(config.castleEmissiveSun);
      intensity = t * config.castleEmissiveIntensity;
    } else {
      const t = timeOfDay - 1;
      c.targetColor.lerpColors(c.sunColor, c.nightColor, t);
      c.emissiveSun.set(config.castleEmissiveSun);
      c.emissiveNight.set(config.castleEmissiveNight);
      c.targetEmissive.lerpColors(c.emissiveSun, c.emissiveNight, t);
      intensity = config.castleEmissiveIntensity;
    }

    for (const m of materials) {
      if (m.isMeshStandardMaterial) {
        m.color.copy(c.targetColor);
        m.emissive.copy(c.targetEmissive);
        m.emissiveIntensity = intensity;
      }
    }
  });

  return (
    <group position={position} rotation={rotation} scale={scaleFactor}>
      <primitive 
        object={clonedScene} 
        position={[offset.x, offset.y, offset.z]} 
      />
    </group>
  );
}

useGLTF.preload('/assets/models/castle_ruin.glb');

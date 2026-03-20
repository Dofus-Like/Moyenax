import React, { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export interface BushProps {
  position: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
}

export function Bush({ 
  position, 
  scale = 1.0, 
  rotation = [0, 0, 0] 
}: BushProps) {
  const { scene } = useGLTF('/assets/models/bushes.glb');
  const groupRef = useRef<THREE.Group>(null);

  const clonedBush = useMemo(() => {
    const fullClone = scene.clone(true);

    // Extraction du buisson le plus à gauche parmi les enfants
    // Certains GLB compressent tout dans un seul groupe 'Scene'
    const topLevel = fullClone.children.filter(
      (c) => c.type === 'Group' || c.type === 'Object3D' || (c as THREE.Mesh).isMesh
    );

    let selectedObject: THREE.Object3D | null = null;

    if (topLevel.length >= 3) {
      topLevel.sort((a, b) => a.position.x - b.position.x);
      selectedObject = topLevel[0];
    } else if (topLevel.length === 1) {
      const subChildren = topLevel[0].children.filter(
        (c) => c.type === 'Group' || c.type === 'Object3D' || (c as THREE.Mesh).isMesh
      );
      if (subChildren.length >= 3) {
        subChildren.sort((a, b) => a.position.x - b.position.x);
        selectedObject = subChildren[0];
      }
    }

    const result = new THREE.Group();
    if (selectedObject) {
      const child = selectedObject.clone(true);
      child.position.set(0, 0, 0);
      result.add(child);
    } else {
      // Fallback si la détection échoue
      fullClone.position.set(0, 0, 0);
      result.add(fullClone);
    }

    return result;
  }, [scene]);

  return (
    <group 
      ref={groupRef} 
      position={position} 
      scale={scale} 
      rotation={rotation}
    >
      <primitive object={clonedBush} />
    </group>
  );
}

// Pré-chargement
useGLTF.preload('/assets/models/bushes.glb');

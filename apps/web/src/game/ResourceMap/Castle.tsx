import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface CastleProps {
  position: [number, number, number];
  targetSize?: number;
  rotation?: [number, number, number];
}

export function Castle({ position, targetSize, rotation = [0, 0, 0] }: CastleProps) {
  const { scene } = useGLTF('/assets/models/castle_ruin.glb');

  const { clonedScene, scaleFactor, offset } = useMemo(() => {
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
      offset: new THREE.Vector3(-center.x, -topY, -center.z) 
    };
  }, [scene, targetSize]);

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

import React, { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export interface TreeProps {
  position: [number, number, number];
  scale?: number;
  seed?: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

export function Tree({ position, scale = 0.35, seed = 0 }: TreeProps) {
  const { scene } = useGLTF('/assets/models/trees.glb');

  const clonedTree = useMemo(() => {
    const fullClone = scene.clone(true);
    
    // Détection des modèles pour trees.glb
    const candidates = fullClone.children.filter(
      (c) => c.type === 'Group' || c.type === 'Object3D' || (c as THREE.Mesh).isMesh
    );

    let models = candidates;
    if (candidates.length === 1 && candidates[0].children.length >= 2) {
      models = candidates[0].children.filter(
        (c) => c.type === 'Group' || c.type === 'Object3D' || (c as THREE.Mesh).isMesh
      );
    }

    if (models.length === 0) return fullClone;

    const idx = Math.floor(seededRandom(seed) * models.length);
    const chosen = models[idx];

    const result = new THREE.Group();
    const treeClone = chosen.clone(true);
    treeClone.position.set(0, 0, 0); 
    
    // On garde la rotation Y aléatoire qui plaisait bien
    result.rotation.y = seededRandom(seed * 7) * Math.PI * 2;
    result.add(treeClone);

    return result;
  }, [scene, seed]);

  return (
    <group position={position} scale={scale}>
      {clonedTree && <primitive object={clonedTree} />}
    </group>
  );
}

useGLTF.preload('/assets/models/trees.glb');

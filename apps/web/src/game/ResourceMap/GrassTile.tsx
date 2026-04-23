import React, { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export interface GrassTileProps {
  position: [number, number, number];
  seed?: number;
  scale?: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * GrassTile – Affiche un carré de sol en utilisant le modèle GLB grass.glb.
 * Si le fichier contient plusieurs variantes de sol, une est choisie aléatoirement
 * de façon stable grâce au seed de la case.
 */
export function GrassTile({ position, seed = 0, scale = 1.0 }: GrassTileProps) {
  const { scene } = useGLTF('/assets/models/grass.glb');

  const clonedTile = useMemo(() => {
    const fullClone = scene.clone(true);

    // Chercher les objets utilisables dans la scène
    const candidates = fullClone.children.filter(
      (c) => c.type === 'Group' || c.type === 'Object3D' || (c as THREE.Mesh).isMesh,
    );

    let models = candidates;

    // Si un seul groupe racine, regarder ses enfants
    if (candidates.length === 1 && candidates[0].children.length >= 2) {
      const subCandidates = candidates[0].children.filter(
        (c) => c.type === 'Group' || c.type === 'Object3D' || (c as THREE.Mesh).isMesh,
      );
      if (subCandidates.length > 0) {
        models = subCandidates;
      }
    }

    // Sélection stable selon le seed
    if (models.length === 0) return null;

    const idx = Math.floor(seededRandom(seed) * models.length);
    const chosen = models[idx];

    const result = new THREE.Group();
    const tileClone = chosen.clone(true);
    tileClone.position.set(0, 0, 0);

    // Rotation Y aléatoire pour éviter la répétition visuelle
    result.rotation.y = Math.round(seededRandom(seed * 13) * 3) * (Math.PI / 2);

    result.add(tileClone);
    return result;
  }, [scene, seed]);

  if (!clonedTile) return null;

  return (
    <group position={position} scale={scale}>
      <primitive object={clonedTile} />
    </group>
  );
}

useGLTF.preload('/assets/models/grass.glb');

import { useFBX, useTexture } from '@react-three/drei';
import React, { useMemo } from 'react';
import * as THREE from 'three';

export interface TreeProps {
  position: [number, number, number];
  scale?: number;
  seed?: number;
}

const TREE_URLS = [
  '/assets/models/Tree_01.fbx',
  '/assets/models/Tree_02.fbx',
  '/assets/models/Tree_03.fbx',
  '/assets/models/Tree_04.fbx',
  '/assets/models/Tree_05.fbx',
];

const TEXTURE_PATH = '/assets/models/SimpleNature_Texture.png';

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * TreeModel – Affiche un arbre FBX avec sa texture et correction de position
 */
function TreeModel({ url, rotationY, texture }: { url: string; rotationY: number; texture: THREE.Texture }) {
  const fbx = useFBX(url);

  const { clonedTree, offset } = useMemo(() => {
    const clone = fbx.clone(true);

    // Calcul de l'enveloppe pour centrer au pied
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const bottom = box.min.y;

    // Application de la texture et correction materials
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            // Appliquer la texture PNG
            if ('map' in m) {
              (m as any).map = texture;
              (m as any).map.colorSpace = THREE.SRGBColorSpace;
              (m as any).color.setHex(0xffffff); // Blanc pour ne pas teinter la texture
            }
            if ('shininess' in m) (m as any).shininess = 0;
            m.needsUpdate = true;
          }
        }
      }
    });

    return {
      clonedTree: clone,
      offset: [-center.x, -bottom, -center.z] as [number, number, number]
    };
  }, [fbx, texture]);

  return (
    <group rotation={[0, rotationY, 0]} scale={0.015}>
      <primitive object={clonedTree} position={offset} />
    </group>
  );
}

export function Tree({ position, scale = 0.35, seed = 0 }: TreeProps) {
  const texture = useTexture(TEXTURE_PATH);

  const urlIdx = Math.floor(seededRandom(seed) * TREE_URLS.length);
  const selectedUrl = TREE_URLS[urlIdx];
  const rotationY = seededRandom(seed * 7) * Math.PI * 2;

  return (
    <group position={position} scale={scale}>
      <TreeModel url={selectedUrl} rotationY={rotationY} texture={texture} />
    </group>
  );
}

// Pré-chargement
for (const url of TREE_URLS) useFBX.preload(url);
useTexture.preload(TEXTURE_PATH);

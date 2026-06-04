import { useGLTF } from '@react-three/drei';
import React, { useMemo } from 'react';
import * as THREE from 'three';

import { modelUrl } from '../models/modelRegistry';

const VERDANT_URL = modelUrl('environments/verdant_battlefield.glb');

interface VerdantBattlefieldProps {
  position?: [number, number, number];
  targetSize?: number;
  rotation?: [number, number, number];
}

interface SceneData {
  clonedScene: THREE.Group;
  scaleFactor: number;
  offset: THREE.Vector3;
}

function optimizeScene(scene: THREE.Group, targetSize: number): SceneData {
  const clone = scene.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.z);
  const factor = targetSize ? targetSize / maxDim : 1;

  const center = new THREE.Vector3();
  box.getCenter(center);
  const minY = box.min.y;

  clone.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const newMaterials = materials.map((mat) => {
          // Cast to intersection type to access map and color safely without 'any'
          const m = mat as THREE.Material & {
            map?: THREE.Texture | null;
            color?: THREE.Color;
          };
          const basicMat = new THREE.MeshBasicMaterial({
            map: m.map ?? null,
            color: m.color ?? new THREE.Color(0xffffff),
            transparent: false,
            opacity: 1,
            depthWrite: m.depthWrite,
          });
          return basicMat;
        });
        mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
      }
    }
  });

  return {
    clonedScene: clone,
    scaleFactor: factor,
    offset: new THREE.Vector3(-center.x, -minY, -center.z),
  };
}

export const VerdantBattlefield = React.memo(
  ({
    position = [0, -1.27, 0],
    targetSize = 12,
    rotation = [0, 0, 0],
  }: VerdantBattlefieldProps) => {
    const { scene } = useGLTF(VERDANT_URL);

    const { clonedScene, scaleFactor, offset } = useMemo(
      () => optimizeScene(scene, targetSize),
      [scene, targetSize],
    );

    const dynamicPosition: [number, number, number] = [position[0], position[1], position[2]];

    return (
      <group position={dynamicPosition} rotation={rotation} scale={scaleFactor}>
        <primitive object={clonedScene} position={[offset.x, offset.y, offset.z]} />
      </group>
    );
  },
);

useGLTF.preload(VERDANT_URL);

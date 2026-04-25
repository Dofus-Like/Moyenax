import { useFBX, useTexture } from '@react-three/drei';
import React, { useMemo } from 'react';
import * as THREE from 'three';

export interface BushProps {
  position: [number, number, number];
  scale?: number;
  seed?: number;
}

const BUSH_URL = '/assets/models/Bush_03.fbx';
const TEXTURE_PATH = '/assets/models/SimpleNature_Texture.png';

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * BushModel – Affiche le buisson (modèle 03) avec texture et centrage
 */
function BushModel({ url, rotationY, texture }: { url: string; rotationY: number; texture: THREE.Texture }) {
  const fbx = useFBX(url);

  const { clonedBush, offset } = useMemo(() => {
    const clone = fbx.clone(true);
    
    // Calcul de la Bounding Box pour centrer au pied
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const bottom = box.min.y;

    // Correction des ombres et des matériaux
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if ('map' in m) {
              (m as any).map = texture;
              (m as any).map.colorSpace = THREE.SRGBColorSpace;
              (m as any).color.setHex(0xffffff);
            }
            if ('shininess' in m) (m as any).shininess = 0;
            m.needsUpdate = true;
          }
        }
      }
    });

    return { 
      clonedBush: clone, 
      offset: [-center.x, -bottom, -center.z] as [number, number, number] 
    };
  }, [fbx, texture]);

  // FBX scale multiplier
  return (
    <group rotation={[0, rotationY, 0]} scale={0.01}>
      <primitive object={clonedBush} position={offset} />
    </group>
  );
}

export function Bush({ position, scale = 1.0, seed = 0 }: BushProps) {
  const texture = useTexture(TEXTURE_PATH);
  
  // On utilise uniquement le buisson 3 comme demandé
  const rotationY = seededRandom(seed * 3) * Math.PI * 2;

  return (
    <group position={position} scale={scale}>
      <BushModel url={BUSH_URL} rotationY={rotationY} texture={texture} />
    </group>
  );
}

useFBX.preload(BUSH_URL);
useTexture.preload(TEXTURE_PATH);

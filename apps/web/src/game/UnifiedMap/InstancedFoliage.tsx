import React, { useRef, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFBX, useTexture } from '@react-three/drei';
import { GameMap, TerrainType, TERRAIN_PROPERTIES, CombatTerrainType } from '@game/shared-types';

const BUSH_URL = '/assets/models/Bush_03.fbx';
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

interface FoliageData {
  x: number;
  y: number;
  type: 'bush' | 'tree';
  variant: number;
  seed: number;
}

interface Asset {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/**
 * InstancedFoliage – Renders all trees and bushes using instancedMesh for maximum performance.
 */
export const InstancedFoliage = React.memo(({ map }: { map: GameMap }) => {
  const texture = useTexture(TEXTURE_PATH);
  const bushFbx = useFBX(BUSH_URL);
  const treeFbxs = [
    useFBX(TREE_URLS[0]),
    useFBX(TREE_URLS[1]),
    useFBX(TREE_URLS[2]),
    useFBX(TREE_URLS[3]),
    useFBX(TREE_URLS[4]),
  ];

  const extractAndPrepareMesh = (group: THREE.Group): Asset | null => {
    let bestMesh: THREE.Mesh | null = null;
    let maxVertexCount = -1;

    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        const name = (mesh.name || '').toLowerCase();
        if (name.includes('collider') || name.includes('helper') || name.includes('dummy')) return;

        const count = mesh.geometry.attributes.position.count;
        if (count > maxVertexCount) {
          maxVertexCount = count;
          bestMesh = mesh;
        }
      }
    });

    if (!bestMesh) return null;

    const geometry = (bestMesh as THREE.Mesh).geometry.clone();
    // Manual transformation application since matrixWorld might be identity here
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const bottom = box.min.y;
    geometry.translate(-center.x, -bottom, -center.z);

    const matValue = (bestMesh as THREE.Mesh).material;
    const material = (
      Array.isArray(matValue) ? matValue[0] : matValue
    ).clone() as THREE.MeshStandardMaterial;

    material.map = texture;
    material.map.colorSpace = THREE.SRGBColorSpace;
    material.color.setHex(0xffffff);
    material.needsUpdate = true;

    return { geometry, material };
  };

  const foliageAssets = useMemo(() => {
    const assets: (Asset | null)[] = [];
    assets[0] = extractAndPrepareMesh(bushFbx);
    treeFbxs.forEach((fbx, i) => {
      assets[i + 1] = extractAndPrepareMesh(fbx);
    });
    return assets;
  }, [bushFbx, treeFbxs, texture]);

  const foliageList = useMemo(() => {
    const list: FoliageData[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.grid[y][x] as TerrainType;
        const props = TERRAIN_PROPERTIES[terrain];

        if (props.combatType === CombatTerrainType.WALL && terrain === TerrainType.WOOD) {
          list.push({
            x,
            y,
            type: 'tree',
            variant: Math.floor(seededRandom(x * 1000 + y) * TREE_URLS.length),
            seed: x * 1000 + y,
          });
        } else if (
          props.combatType === CombatTerrainType.FLAT &&
          props.harvestable &&
          terrain === TerrainType.HERB
        ) {
          list.push({ x, y, type: 'bush', variant: 0, seed: x * 1000 + y });
        }
      }
    }
    return list;
  }, [map]);

  const bushMeshRef = useRef<THREE.InstancedMesh>(null);
  const treeMeshRefs = [
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
  ];

  useLayoutEffect(() => {
    const allRefs = [bushMeshRef, ...treeMeshRefs];
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

    allRefs.forEach((ref) => {
      if (ref.current) {
        for (let i = 0; i < ref.current.count; i++) {
          ref.current.setMatrixAt(i, zeroMatrix);
        }
      }
    });

    if (foliageList.length === 0) {
      allRefs.forEach((ref) => {
        if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
      });
      return;
    }

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();
    const counts = new Array(6).fill(0);

    foliageList.forEach((item) => {
      const idx = item.type === 'bush' ? 0 : item.variant + 1;
      const ref = allRefs[idx];
      if (!ref.current) return;

      const worldX = item.x - map.width / 2 + 0.5;
      const worldZ = item.y - map.height / 2 + 0.5;
      const s = item.type === 'bush' ? 0.01 : 0.015 * 0.35;
      const rotY = seededRandom(item.seed * (item.type === 'bush' ? 3 : 7)) * Math.PI * 2;

      position.set(worldX, 0, worldZ);
      euler.set(0, rotY, 0);
      rotation.setFromEuler(euler);
      scale.set(s, s, s);

      matrix.compose(position, rotation, scale);
      ref.current.setMatrixAt(counts[idx], matrix);
      counts[idx]++;
    });

    allRefs.forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    });
  }, [foliageList, map]);

  return (
    <group>
      {foliageAssets[0] && (
        <instancedMesh
          ref={bushMeshRef}
          args={[
            foliageAssets[0].geometry,
            foliageAssets[0].material,
            foliageList.filter((f) => f.type === 'bush').length || 1,
          ]}
          castShadow
          receiveShadow
          raycast={() => null}
        />
      )}
      {treeMeshRefs.map((ref, i) => {
        const asset = foliageAssets[i + 1];
        if (!asset) return null;
        return (
          <instancedMesh
            key={`tree-${i}`}
            ref={ref}
            args={[
              asset.geometry,
              asset.material,
              foliageList.filter((f) => f.type === 'tree' && f.variant === i).length || 1,
            ]}
            castShadow
            receiveShadow
            raycast={() => null}
          />
        );
      })}
    </group>
  );
});

useFBX.preload(BUSH_URL);
TREE_URLS.forEach((url) => useFBX.preload(url));
useTexture.preload(TEXTURE_PATH);

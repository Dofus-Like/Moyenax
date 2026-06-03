import { useFBX, useGLTF, useTexture } from '@react-three/drei';
import React, { useRef, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { GameMap } from '@game/shared-types';
import { TerrainType, TERRAIN_PROPERTIES, CombatTerrainType } from '@game/shared-types';

const BUSH_URL = '/assets/models/Bush_03.fbx';
const TREE_URLS = [
  '/assets/models/Tree_02.fbx',
  '/assets/models/Tree_04.fbx',
];
const ROCK_URL = '/assets/models/rock_pile.glb';
const TEXTURE_PATH = '/assets/models/forest_texture.png';

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

interface FoliageData {
  x: number;
  y: number;
  type: 'bush' | 'tree' | 'rock';
  variant: number;
  seed: number;
}

interface Asset {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

function extractMergedGeometry(group: THREE.Group): THREE.BufferGeometry | null {
  const cloned = group.clone(true);
  cloned.updateMatrixWorld(true);

  const subGeos: THREE.BufferGeometry[] = [];
  cloned.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.name || '').toLowerCase();
    if (name.includes('collider') || name.includes('helper') || name.includes('dummy')) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    subGeos.push(geo);
  });

  if (subGeos.length === 0) return null;

  const merged = subGeos.length === 1 ? subGeos[0] : (mergeGeometries(subGeos, false) ?? subGeos[0]);
  merged.computeBoundingBox();
  const box = merged.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  merged.translate(-center.x, -box.min.y, -center.z);
  return merged;
}

export const InstancedFoliage = React.memo(({ map }: { map: GameMap }) => {
  const texture = useTexture(TEXTURE_PATH);
  texture.colorSpace = THREE.SRGBColorSpace;

  const bushFbx = useFBX(BUSH_URL);
  const tree0 = useFBX(TREE_URLS[0]);
  const tree1 = useFBX(TREE_URLS[1]);
  const treeFbxs = useMemo(() => [tree0, tree1], [tree0, tree1]);
  const { scene: rockScene } = useGLTF(ROCK_URL);

  // FBX assets (trees/bushes): forest_texture.png + matte material (fix plastic look)
  const extractFBXAsset = React.useCallback((group: THREE.Group): Asset | null => {
    const geometry = extractMergedGeometry(group);
    if (!geometry) return null;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1.0,
      metalness: 0.0,
    });
    return { geometry, material };
  }, [texture]);

  // GLB rock asset: use native PBR material from file
  const rockAsset = useMemo((): Asset | null => {
    const geometry = extractMergedGeometry(rockScene as unknown as THREE.Group);
    if (!geometry) return null;
    let sourceMaterial: THREE.Material | null = null;
    rockScene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !sourceMaterial) {
        sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      }
    });
    const material = sourceMaterial
      ? (sourceMaterial as THREE.Material).clone()
      : new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, metalness: 0.1 });
    return { geometry, material };
  }, [rockScene]);

  const foliageAssets = useMemo(() => {
    // [0]=bush [1]=tree0 [2]=tree1 [3]=rock
    const assets: (Asset | null)[] = [];
    assets[0] = extractFBXAsset(bushFbx);
    for (const [i, fbx] of treeFbxs.entries()) {
      assets[i + 1] = extractFBXAsset(fbx);
    }
    assets[3] = rockAsset;
    return assets;
  }, [bushFbx, treeFbxs, extractFBXAsset, rockAsset]);

  const foliageList = useMemo(() => {
    const list: FoliageData[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.grid[y][x] as TerrainType;
        const props = TERRAIN_PROPERTIES[terrain];

        if (terrain === TerrainType.WOOD) {
          list.push({ x, y, type: 'tree', variant: Math.floor(seededRandom(x * 1000 + y) * TREE_URLS.length), seed: x * 1000 + y });
        } else if (terrain === TerrainType.HERB) {
          list.push({ x, y, type: 'bush', variant: 0, seed: x * 1000 + y });
        } else if (props.combatType === CombatTerrainType.WALL) {
          list.push({ x, y, type: 'rock', variant: 0, seed: x * 1000 + y });
        }
      }
    }
    return list;
  }, [map]);

  const bushMeshRef = useRef<THREE.InstancedMesh>(null);
  const treeMeshRef0 = useRef<THREE.InstancedMesh>(null);
  const treeMeshRef1 = useRef<THREE.InstancedMesh>(null);
  const rockMeshRef = useRef<THREE.InstancedMesh>(null);
  // allRefs idx: [0]=bush [1]=tree0 [2]=tree1 [3]=rock
  const allRefs = useMemo(
    () => [bushMeshRef, treeMeshRef0, treeMeshRef1, rockMeshRef],
    [],
  );

  useLayoutEffect(() => {
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const ref of allRefs) {
      if (ref.current) {
        for (let i = 0; i < ref.current.count; i++) {
          ref.current.setMatrixAt(i, zeroMatrix);
        }
      }
    }

    if (foliageList.length === 0) {
      for (const ref of allRefs) { if (ref.current) ref.current.instanceMatrix.needsUpdate = true; }
      return;
    }

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();
    const counts = [0, 0, 0, 0]; // [bush, tree0, tree1, rock]

    for (const item of foliageList) {
      let idx: number;
      let s: number;

      if (item.type === 'bush') {
        idx = 0;
        s = 0.05;
      } else if (item.type === 'tree') {
        idx = item.variant + 1;
        s = 0.015 * 0.35;
      } else {
        idx = 3;
        s = 0.8;
      }

      const ref = allRefs[idx];
      if (!ref.current) continue;

      const worldX = item.x - map.width / 2 + 0.5;
      const worldZ = item.y - map.height / 2 + 0.5;
      const rotY = seededRandom(item.seed * 7) * Math.PI * 2;

      position.set(worldX, 0, worldZ);
      euler.set(0, rotY, 0);
      rotation.setFromEuler(euler);
      scale.set(s, s, s);
      matrix.compose(position, rotation, scale);
      ref.current.setMatrixAt(counts[idx], matrix);
      counts[idx]++;
    }

    for (const ref of allRefs) {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    }
  }, [foliageList, map, allRefs]);

  const bushCount = foliageList.filter(f => f.type === 'bush').length || 1;
  const rockCount = foliageList.filter(f => f.type === 'rock').length || 1;

  return (
    <group>
      {foliageAssets[0] && (
        <instancedMesh ref={bushMeshRef} args={[foliageAssets[0].geometry, foliageAssets[0].material, bushCount]} castShadow receiveShadow raycast={() => null} />
      )}
      {[treeMeshRef0, treeMeshRef1].map((ref, i) => {
        const asset = foliageAssets[i + 1];
        if (!asset) return null;
        const count = foliageList.filter(f => f.type === 'tree' && f.variant === i).length || 1;
        return (
          <instancedMesh key={`tree-${i}`} ref={ref} args={[asset.geometry, asset.material, count]} castShadow receiveShadow raycast={() => null} />
        );
      })}
      {foliageAssets[3] && (
        <instancedMesh ref={rockMeshRef} args={[foliageAssets[3].geometry, foliageAssets[3].material, rockCount]} castShadow receiveShadow raycast={() => null} />
      )}
    </group>
  );
});

useFBX.preload(BUSH_URL);
for (const url of TREE_URLS) useFBX.preload(url);
useGLTF.preload(ROCK_URL);
useTexture.preload(TEXTURE_PATH);

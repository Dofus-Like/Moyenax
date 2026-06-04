import { useFBX, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useRef, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { GameMap } from "@game/shared-types";
import {
  TerrainType,
  TERRAIN_PROPERTIES,
  CombatTerrainType,
} from "@game/shared-types";

import { assetUrl } from "../constants/assetUrl";

const BUSH_URLS = ["/assets/models/Bush_4E.fbx", "/assets/models/Bush_4F.fbx"].map(assetUrl);
const TREE_URLS = ["/assets/models/Tree_02.fbx", "/assets/models/Tree_04.fbx"].map(assetUrl);
const ROCK_FBX_URLS = [
  "/assets/models/Rock_2E.fbx",
  "/assets/models/Rock_2F.fbx",
  "/assets/models/Rock_2G.fbx",
  "/assets/models/Rock_2H.fbx",
].map(assetUrl);
const GRASS_URLS = [
  "/assets/models/Grass_1A.fbx",
  "/assets/models/Grass_1B.fbx",
  "/assets/models/Grass_2A.fbx",
  "/assets/models/Grass_2B.fbx",
].map(assetUrl);
const TEXTURE_PATH = assetUrl("/assets/models/forest_texture.png");

// Slots = one InstancedMesh per (category, variant). Fixed order: bush, tree, rock, grass.
const BUSH_SLOT = 0;
const TREE_SLOT = BUSH_SLOT + BUSH_URLS.length;
const ROCK_SLOT = TREE_SLOT + TREE_URLS.length;
const ROCK_VARIANTS = ROCK_FBX_URLS.length;
const GRASS_SLOT = ROCK_SLOT + ROCK_VARIANTS;
const GRASS_VARIANTS = GRASS_URLS.length;
const SLOT_COUNT = GRASS_SLOT + GRASS_VARIANTS;

// Grass cluster optimization: we merge CLUSTER_SIZE tufts into a single geometry.
// Instead of rendering 300-600 individual instances per tile, we render a smaller set of clusters.
// This yields dense grass with extremely low vertex and draw-call count, plus zero shadow map overhead.
const CLUSTER_SIZE = 40;
const GRASS_SPREAD = 1.1; // Spread of tufts within a cluster (from center)
const GRASS_MIN_TUFTS = 6; // Min clusters per tile (6 * 40 = 240 tufts)
const GRASS_MAX_TUFTS = 6; // Max clusters per tile (6 * 40 = 240 tufts)
const GRASS_JITTER = 0.2; // Jitter of the cluster centers on the tile

// FBX sources are in cm; bushes/trees keep their hand-tuned multipliers.
const TREE_SCALE = 0.015 * 0.35;
// Bushes/rocks/grass are normalised by footprint so new variants share a coherent size.
const BUSH_TARGET = 0.8;
const ROCK_TARGET = 0.84; // 0.84 = 1.05 - 20%
const GRASS_TARGET = 0.06;

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

interface FoliageData {
  x: number;
  y: number;
  slot: number;
  seed: number;
  ox: number;
  oz: number;
}

function pushGrass(
  list: FoliageData[],
  x: number,
  y: number,
  seed: number,
): void {
  const tufts =
    GRASS_MIN_TUFTS + Math.floor(seededRandom(seed * 17) * GRASS_MAX_TUFTS);
  for (let i = 0; i < tufts; i++) {
    const gs = seed * 100 + i;
    list.push({
      x,
      y,
      slot: GRASS_SLOT + Math.floor(seededRandom(gs * 19) * GRASS_VARIANTS),
      seed: gs,
      ox: (seededRandom(gs * 23) - 0.5) * GRASS_JITTER,
      oz: (seededRandom(gs * 29) - 0.5) * GRASS_JITTER,
    });
  }
}

interface Asset {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  scale: number;
}

interface MergedGeometry {
  geometry: THREE.BufferGeometry;
  size: THREE.Vector3;
}

function fitScale(size: THREE.Vector3, targetFootprint: number): number {
  const maxDim = Math.max(size.x, size.z);
  return maxDim > 0 ? targetFootprint / maxDim : 1;
}

function extractMergedGeometry(group: THREE.Group): MergedGeometry | null {
  const cloned = group.clone(true);
  cloned.updateMatrixWorld(true);

  const subGeos: THREE.BufferGeometry[] = [];
  cloned.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.name || "").toLowerCase();
    if (
      name.includes("collider") ||
      name.includes("helper") ||
      name.includes("dummy")
    )
      return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    subGeos.push(geo);
  });

  if (subGeos.length === 0) return null;

  const merged =
    subGeos.length === 1
      ? subGeos[0]
      : (mergeGeometries(subGeos, false) ?? subGeos[0]);
  merged.computeBoundingBox();
  const box = merged.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  merged.translate(-center.x, -box.min.y, -center.z);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { geometry: merged, size };
}

function buildFbxAsset(
  group: THREE.Group,
  texture: THREE.Texture,
  scale: number,
  target?: number,
  isGrass?: boolean,
): Asset | null {
  const merged = extractMergedGeometry(group);
  if (!merged) return null;
  // Use MeshLambertMaterial for grass to maximize performance, MeshStandardMaterial for others
  const material = isGrass
    ? new THREE.MeshLambertMaterial({ map: texture })
    : new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 1.0,
        metalness: 0.0,
      });
  return {
    geometry: merged.geometry,
    material,
    scale: target ? fitScale(merged.size, target) : scale,
  };
}

function buildGrassClusterAsset(
  baseAsset: Asset | null,
  clusterSize: number,
  jitterRange: number,
  seedOffset: number,
): Asset | null {
  if (!baseAsset) return null;

  const subGeos: THREE.BufferGeometry[] = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const euler = new THREE.Euler();

  const baseGeo = baseAsset.geometry;
  const baseScale = baseAsset.scale;

  for (let i = 0; i < clusterSize; i++) {
    const geo = baseGeo.clone();
    const seed = seedOffset + i;

    // Position relative within the cluster tile
    position.set(
      (seededRandom(seed * 23) - 0.5) * jitterRange,
      0,
      (seededRandom(seed * 29) - 0.5) * jitterRange,
    );

    // Rotation Y
    euler.set(0, seededRandom(seed * 7) * Math.PI * 2, 0);
    rotation.setFromEuler(euler);

    // Scale variation around baseScale
    const s = baseScale * (0.8 + seededRandom(seed * 31) * 0.4);
    scaleVec.set(s, s, s);

    matrix.compose(position, rotation, scaleVec);
    geo.applyMatrix4(matrix);
    subGeos.push(geo);
  }

  if (subGeos.length === 0) return null;

  const merged = mergeGeometries(subGeos, false);
  if (!merged) return null;

  return {
    geometry: merged,
    material: baseAsset.material,
    scale: 1.0,
  };
}

// Vertex-only wind: bends each blade by its local height, phased by world position.
// Pure GPU math + one shared uTime uniform → no extra geometry, no textures, ~free.
const WIND_VERTEX_CHUNK = `#include <begin_vertex>
  vec4 windWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  float windPhase = uTime * 1.6 + windWorld.x * 0.55 + windWorld.z * 0.55;
  float windBend = max(transformed.y, 0.0) * 0.25;
  transformed.x += sin(windPhase) * windBend;
  transformed.z += cos(windPhase * 0.8) * windBend * 0.6;`;

function applyWind(material: THREE.Material): void {
  material.onBeforeCompile = (shader: THREE.Shader): void => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader =
      `uniform float uTime;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        WIND_VERTEX_CHUNK,
      );
    material.userData.shader = shader;
  };
  material.needsUpdate = true;
}

export const InstancedFoliage = React.memo(({ map, mode }: { map: GameMap; mode?: 'combat' | 'farming' }) => {
  // Mettre à true pour réactiver l'herbe
  const effectiveShowGrass = false;
  const texture = useTexture(TEXTURE_PATH);
  texture.colorSpace = THREE.SRGBColorSpace;

  const bush0 = useFBX(BUSH_URLS[0]);
  const bush1 = useFBX(BUSH_URLS[1]);
  const tree0 = useFBX(TREE_URLS[0]);
  const tree1 = useFBX(TREE_URLS[1]);
  const rock0 = useFBX(ROCK_FBX_URLS[0]);
  const rock1 = useFBX(ROCK_FBX_URLS[1]);
  const rock2 = useFBX(ROCK_FBX_URLS[2]);
  const rock3 = useFBX(ROCK_FBX_URLS[3]);
  const grass0 = useFBX(GRASS_URLS[0]);
  const grass1 = useFBX(GRASS_URLS[1]);
  const grass2 = useFBX(GRASS_URLS[2]);
  const grass3 = useFBX(GRASS_URLS[3]);

  const slots = useMemo<(Asset | null)[]>(() => {
    const out = new Array<Asset | null>(SLOT_COUNT).fill(null);
    out[BUSH_SLOT] = buildFbxAsset(bush0, texture, 0, BUSH_TARGET);
    out[BUSH_SLOT + 1] = buildFbxAsset(bush1, texture, 0, BUSH_TARGET);
    out[TREE_SLOT] = buildFbxAsset(tree0, texture, TREE_SCALE);
    out[TREE_SLOT + 1] = buildFbxAsset(tree1, texture, TREE_SCALE);
    out[ROCK_SLOT] = buildFbxAsset(rock0, texture, 0, ROCK_TARGET);
    out[ROCK_SLOT + 1] = buildFbxAsset(rock1, texture, 0, ROCK_TARGET);
    out[ROCK_SLOT + 2] = buildFbxAsset(rock2, texture, 0, ROCK_TARGET);
    out[ROCK_SLOT + 3] = buildFbxAsset(rock3, texture, 0, ROCK_TARGET);
    const rawGrass0 = buildFbxAsset(grass0, texture, 0, GRASS_TARGET, true);
    const rawGrass1 = buildFbxAsset(grass1, texture, 0, GRASS_TARGET, true);
    const rawGrass2 = buildFbxAsset(grass2, texture, 0, GRASS_TARGET, true);
    const rawGrass3 = buildFbxAsset(grass3, texture, 0, GRASS_TARGET, true);

    out[GRASS_SLOT] = buildGrassClusterAsset(
      rawGrass0,
      CLUSTER_SIZE,
      GRASS_SPREAD,
      1000,
    );
    out[GRASS_SLOT + 1] = buildGrassClusterAsset(
      rawGrass1,
      CLUSTER_SIZE,
      GRASS_SPREAD,
      2000,
    );
    out[GRASS_SLOT + 2] = buildGrassClusterAsset(
      rawGrass2,
      CLUSTER_SIZE,
      GRASS_SPREAD,
      3000,
    );
    out[GRASS_SLOT + 3] = buildGrassClusterAsset(
      rawGrass3,
      CLUSTER_SIZE,
      GRASS_SPREAD,
      4000,
    );
    for (let i = GRASS_SLOT; i < SLOT_COUNT; i++) {
      const grass = out[i];
      if (grass) applyWind(grass.material);
    }
    return out;
  }, [
    bush0,
    bush1,
    tree0,
    tree1,
    rock0,
    rock1,
    rock2,
    rock3,
    grass0,
    grass1,
    grass2,
    grass3,
    texture,
  ]);

  useFrame((state) => {
    for (let i = GRASS_SLOT; i < SLOT_COUNT; i++) {
      const shader = slots[i]?.material.userData.shader as
        | { uniforms: { uTime: { value: number } } }
        | undefined;
      if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const foliageList = useMemo(() => {
    const list: FoliageData[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.grid[y][x] as TerrainType;
        const props = TERRAIN_PROPERTIES[terrain];
        const seed = x * 1000 + y;

        if (terrain === TerrainType.WOOD) {
          list.push({
            x,
            y,
            slot: TREE_SLOT + Math.floor(seededRandom(seed) * TREE_URLS.length),
            seed,
            ox: 0,
            oz: 0,
          });
        } else if (terrain === TerrainType.HERB) {
          list.push({
            x,
            y,
            slot: BUSH_SLOT + Math.floor(seededRandom(seed) * BUSH_URLS.length),
            seed,
            ox: 0,
            oz: 0,
          });
        } else if (props.combatType === CombatTerrainType.WALL && terrain !== TerrainType.WALL) {
          list.push({
            x,
            y,
            slot: ROCK_SLOT + Math.floor(seededRandom(seed) * ROCK_VARIANTS),
            seed,
            ox: 0,
            oz: 0,
          });
        }
        pushGrass(list, x, y, seed);
      }
    }
    return list;
  }, [map]);

  const counts = useMemo(() => {
    const out = new Array<number>(SLOT_COUNT).fill(0);
    for (const item of foliageList) out[item.slot]++;
    return out;
  }, [foliageList]);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    const cursors = new Array<number>(SLOT_COUNT).fill(0);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scaleVec = new THREE.Vector3();
    const euler = new THREE.Euler();

    for (const item of foliageList) {
      const mesh = meshRefs.current[item.slot];
      const asset = slots[item.slot];
      if (!mesh || !asset) continue;

      const s = asset.scale;
      position.set(
        item.x - map.width / 2 + 0.5 + item.ox,
        0,
        item.y - map.height / 2 + 0.5 + item.oz,
      );
      euler.set(0, seededRandom(item.seed * 7) * Math.PI * 2, 0);
      rotation.setFromEuler(euler);
      scaleVec.set(s, s, s);
      matrix.compose(position, rotation, scaleVec);
      mesh.setMatrixAt(cursors[item.slot]++, matrix);
    }

    for (const mesh of meshRefs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  }, [foliageList, slots, map]);

  return (
    <group>
      {slots.map((asset, slot) => {
        const isGrass = slot >= GRASS_SLOT;
        if (isGrass && !effectiveShowGrass) return null;
        return asset && counts[slot] > 0 ? (
          <instancedMesh
            key={slot}
            ref={(el) => {
              meshRefs.current[slot] = el;
            }}
            args={[asset.geometry, asset.material, counts[slot]]}
            castShadow={!isGrass}
            receiveShadow
            raycast={() => null}
          />
        ) : null;
      })}
    </group>
  );
});

for (const url of [...BUSH_URLS, ...TREE_URLS, ...ROCK_FBX_URLS, ...GRASS_URLS])
  useFBX.preload(url);
useTexture.preload(TEXTURE_PATH);

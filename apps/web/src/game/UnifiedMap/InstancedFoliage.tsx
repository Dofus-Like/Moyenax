import { useFBX, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { GameMap } from '@game/shared-types';
import { TerrainType, TERRAIN_PROPERTIES, CombatTerrainType } from '@game/shared-types';

import { createSceneMetricRecorder, isSceneDebugEnabled } from '../../perf/scene-metric-recorder';
import { assetUrl } from '../constants/assetUrl';

import { seededRandom } from './noise';

const BUSH_URLS = ['/assets/models/Bush_4E.fbx', '/assets/models/Bush_4F.fbx'].map(assetUrl);
const TREE_URLS = ['/assets/models/Tree_02.fbx', '/assets/models/Tree_04.fbx'].map(assetUrl);
const ROCK_FBX_URLS = [
  '/assets/models/Rock_2E.fbx',
  '/assets/models/Rock_2F.fbx',
  '/assets/models/Rock_2G.fbx',
  '/assets/models/Rock_2H.fbx',
].map(assetUrl);
const GRASS_URLS = [
  '/assets/models/Grass_1A.fbx',
  '/assets/models/Grass_1B.fbx',
  '/assets/models/Grass_2A.fbx',
  '/assets/models/Grass_2B.fbx',
].map(assetUrl);
const TEXTURE_PATH = assetUrl('/assets/models/forest_texture.png');

// Slots = one InstancedMesh per (category, variant). Fixed order: bush, tree, rock, grass.
const BUSH_SLOT = 0;
const TREE_SLOT = BUSH_SLOT + BUSH_URLS.length;
const ROCK_SLOT = TREE_SLOT + TREE_URLS.length;
const ROCK_VARIANTS = ROCK_FBX_URLS.length;
const GRASS_SLOT = ROCK_SLOT + ROCK_VARIANTS;
const GRASS_VARIANTS = GRASS_URLS.length;
const SLOT_COUNT = GRASS_SLOT + GRASS_VARIANTS;

// Grass grows only in the joints between tiles (like a stone terrace), in seeded
// star-shaped clumps placed on tile-corner junctions. Blades overflow onto tiles.
// All placement derives from a per-map seed (hashMap) so it is random each new combat
// map but identical on page reload of the same combat.
const GRASS_CLUMPS_MIN = 2;          // min sparkle clumps on the whole terrain
const GRASS_CLUMPS_MAX = 6;          // max sparkle clumps
const GRASS_CLUMP_DENSITY_MIN = 500; // min candidate blades per clump
const GRASS_CLUMP_DENSITY_MAX = 2000;// max candidate blades per clump
const GRASS_CLUMP_RADIUS = 0.52;     // max arm reach — straddles the gap and spills onto tiles
const GRASS_STAR_POINTS = 4;         // number of sparkle arms
const GRASS_STAR_SHARPNESS = 8.0;    // higher = thinner, pointier arms
const GRASS_STAR_MIN_RADIUS = 0.05;  // between-arm radius fraction (0 = no blades between arms)
const GRASS_ARM_LENGTH_MIN = 0.8;    // shortest arm fraction — wide gap to MAX = very uneven star
const GRASS_ARM_LENGTH_MAX = 6.0;    // longest arm fraction
const GRASS_CORE_RADIUS_MIN = 0.01;  // min dense central disc radius (world units)
const GRASS_CORE_RADIUS_MAX = 0.1;  // max dense central disc radius
const GRASS_DENSITY_FALLOFF = 0.5;   // higher = sparser toward the arm tips
const GRASS_CLUMP_SALT = 42;         // shifts all clump placement (combine with per-map seed)

// FBX sources are in cm; bushes/trees keep their hand-tuned multipliers.
const TREE_SCALE = 0.015 * 0.35;
// Bushes/rocks/grass are normalised by footprint so new variants share a coherent size.
const BUSH_TARGET = 0.8;
const ROCK_TARGET = 0.84; // 0.84 = 1.05 - 20%
const GRASS_TARGET = 0.05;

const GRASS_OPACITY = 0.9;
const BUSH_OPACITY = 0.7;
const LEAF_OPACITY = 0.99;

export interface FoliageData {
  x: number;
  y: number;
  slot: number;
  seed: number;
  ox: number;
  oz: number;
}

export function isTileWalkable(map: GameMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  const terrain = map.grid[ty][tx] as TerrainType;
  return TERRAIN_PROPERTIES[terrain]?.combatType !== CombatTerrainType.HOLE;
}

// Deterministic FNV-1a hash of the map (dims + every terrain cell). Same combat map →
// same value on reload; a freshly generated map → a different value → different grass.
export function hashMap(map: GameMap): number {
  let h = 2166136261 >>> 0;
  const mix = (v: number): void => {
    h = Math.imul(h ^ v, 16777619) >>> 0;
  };
  mix(map.width);
  mix(map.height);
  for (let y = 0; y < map.height; y++) {
    const row = map.grid[y];
    for (let x = 0; x < map.width; x++) {
      const t = String(row[x]);
      for (let k = 0; k < t.length; k++) mix(t.charCodeAt(k));
    }
  }
  return (h % 1_000_000) + 1;
}

// Place grass clumps on tile-corner junctions (the point where 4 tiles meet).
// Each corner is at world (ix - W/2, iz - H/2) for integer ix,iz — exactly in the gap.
// Blades are scattered radially from that point and spill onto adjacent tiles.
export function buildGrass(list: FoliageData[], map: GameMap): void {
  const baseSeed = hashMap(map) + GRASS_CLUMP_SALT;
  const clumpCount = GRASS_CLUMPS_MIN + Math.floor(seededRandom(baseSeed) * (GRASS_CLUMPS_MAX - GRASS_CLUMPS_MIN + 1));

  for (let c = 0; c < clumpCount; c++) {
    const ix = 1 + Math.floor(seededRandom(baseSeed * 3.1 + c * 7.7) * (map.width - 1));
    const iz = 1 + Math.floor(seededRandom(baseSeed * 5.3 + c * 11.3) * (map.height - 1));

    // Skip corner if all 4 adjacent tiles are unwalkable
    const anyWalkable = isTileWalkable(map, ix - 1, iz - 1) || isTileWalkable(map, ix, iz - 1)
      || isTileWalkable(map, ix - 1, iz) || isTileWalkable(map, ix, iz);
    if (!anyWalkable) continue;

    const cwx = ix - map.width / 2;
    const cwz = iz - map.height / 2;
    const density = GRASS_CLUMP_DENSITY_MIN + Math.floor(seededRandom(baseSeed + c * 19) * (GRASS_CLUMP_DENSITY_MAX - GRASS_CLUMP_DENSITY_MIN));

    // Per-clump: each arm gets its own length multiplier (wide range → uneven sparkle).
    const armLengths: number[] = [];
    for (let a = 0; a < GRASS_STAR_POINTS; a++) {
      armLengths.push(GRASS_ARM_LENGTH_MIN + seededRandom(baseSeed + c * 37 + a * 13) * (GRASS_ARM_LENGTH_MAX - GRASS_ARM_LENGTH_MIN));
    }
    // Dense core disc, radius varies per clump (fills the very center regardless of star shape).
    const coreRadius = GRASS_CORE_RADIUS_MIN + seededRandom(baseSeed + c * 53) * (GRASS_CORE_RADIUS_MAX - GRASS_CORE_RADIUS_MIN);

    for (let b = 0; b < density; b++) {
      const bseed = baseSeed + c * 1000 + b;
      const r = seededRandom(bseed * 2.1) * GRASS_CLUMP_RADIUS;
      const theta = seededRandom(bseed * 3.7) * Math.PI * 2;

      // Star shape: rMax = arm length * starFactor (peaks at arm angles, shrinks between).
      const armIdx = Math.floor((theta / (Math.PI * 2)) * GRASS_STAR_POINTS) % GRASS_STAR_POINTS;
      const starFactor = Math.pow(Math.max(0, Math.cos(GRASS_STAR_POINTS * theta)), GRASS_STAR_SHARPNESS);
      const rMax = GRASS_CLUMP_RADIUS * armLengths[armIdx] * (GRASS_STAR_MIN_RADIUS + starFactor * (1 - GRASS_STAR_MIN_RADIUS));

      const inCore = r < coreRadius;
      if (!inCore && r > rMax) continue;

      // Density falloff outside core: dense at center, sparse toward tips.
      if (!inCore) {
        const normalized = r / Math.max(rMax, 0.001);
        if (seededRandom(bseed * 5.9) > Math.pow(1 - normalized, GRASS_DENSITY_FALLOFF)) continue;
      }

      const bwx = cwx + r * Math.cos(theta);
      const bwz = cwz + r * Math.sin(theta);
      const tx = Math.floor(bwx + map.width / 2);
      const tz = Math.floor(bwz + map.height / 2);
      if (!isTileWalkable(map, tx, tz)) continue;
      list.push({
        x: tx,
        y: tz,
        slot: GRASS_SLOT + Math.floor(seededRandom(bseed * 13) * GRASS_VARIANTS),
        seed: bseed,
        ox: bwx - (tx - map.width / 2 + 0.5),
        oz: bwz - (tz - map.height / 2 + 0.5),
      });
    }
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
  const size = new THREE.Vector3();
  box.getSize(size);
  return { geometry: merged, size };
}

type GreenSampler = (u: number, v: number) => number;

// Read the shared texture once into a canvas, expose per-UV "greenness" (how much the
// pixel leans green vs red/blue). Used to tell tree leaves from trunk/branches.
function buildGreenSampler(texture: THREE.Texture): GreenSampler | null {
  const img = texture.image as HTMLImageElement | ImageBitmap | undefined;
  const w = img?.width ?? 0;
  const h = img?.height ?? 0;
  if (!img || !w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  return (u, v) => {
    const px = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
    const py = Math.min(h - 1, Math.max(0, Math.floor((1 - v) * h)));
    const idx = (py * w + px) * 4;
    const r = data[idx] / 255;
    const g = data[idx + 1] / 255;
    const b = data[idx + 2] / 255;
    return Math.max(0, g - Math.max(r, b));
  };
}

// Bake a 0..1 "is this vertex a leaf" mask into the geometry from its UVs, so the wind
// shader can move only the green-textured parts without sampling textures on the GPU.
function addLeafMask(geo: THREE.BufferGeometry, sample: GreenSampler): boolean {
  const uv = geo.getAttribute('uv');
  if (!uv) return false;
  const mask = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) {
    mask[i] = Math.min(1, sample(uv.getX(i), uv.getY(i)) * 6);
  }
  geo.setAttribute('aLeaf', new THREE.BufferAttribute(mask, 1));
  return true;
}

interface FbxAssetOptions {
  scale?: number;
  target?: number;
  opacity?: number;
  wind?: 'grass' | 'leaf';
  greenSampler?: GreenSampler | null;
}

function buildFbxAsset(group: THREE.Group, texture: THREE.Texture, opts: FbxAssetOptions): Asset | null {
  const merged = extractMergedGeometry(group);
  if (!merged) return null;
  const opacity = opts.opacity ?? 1;
  // roughness 1 / metalness 0 keeps the matte look (no plastic highlights) under scene lighting.
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1.0,
    metalness: 0.0,
    transparent: opacity < 1,
    opacity,
  });
  if (opts.wind === 'grass') applyGrassWind(material);
  if (opts.wind === 'leaf' && opts.greenSampler && addLeafMask(merged.geometry, opts.greenSampler)) {
    applyLeafWind(material);
  }
  const scale = opts.target ? fitScale(merged.size, opts.target) : (opts.scale ?? 1);
  return { geometry: merged.geometry, material, scale };
}

// Vertex-only wind: bends each blade by its local height, phased by world position.
// Pure GPU math + one shared uTime uniform → no extra geometry, no textures, ~free.
const GRASS_WIND_CHUNK = `#include <begin_vertex>
  vec4 windWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  float windPhase = uTime * 1.6 + windWorld.x * 0.55 + windWorld.z * 0.55;
  float windBend = max(transformed.y, 0.0) * 0.25;
  transformed.x += sin(windPhase) * windBend;
  transformed.z += cos(windPhase * 0.8) * windBend * 0.6;`;

function applyGrassWind(material: THREE.Material): void {
  material.onBeforeCompile = (shader): void => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      GRASS_WIND_CHUNK,
    );
    material.userData.shader = shader;
  };
  material.needsUpdate = true;
}

// Leaf wind: amplitude scales with the baked green mask and local height, so only the
// upper green canopy moves while the trunk (mask ~0) stays rigid.
// Realism comes from layering three signals:
//   - gust: slow envelope travelling across the world → waves of stronger/weaker wind
//   - sway: directional base oscillation
//   - flutter: faster, smaller secondary wobble on the leaf tips
// A small downward dip (-y) sells a real bend instead of a flat slide.
const LEAF_WIND_FACTOR = 0.005;
const LEAF_WIND_CHUNK = `#include <begin_vertex>
  vec4 leafWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  float leafPhase = uTime * 1.2 + leafWorld.x * 0.4 + leafWorld.z * 0.4;
  float gust = 5.55 + 0.85 * sin(uTime * 0.45 + leafWorld.x * 0.15 + leafWorld.z * 0.1);
  float sway = sin(leafPhase) + 0.05 * sin(leafPhase * 2.3 + 1.7);
  float leafBend = aLeaf * max(transformed.y, 0.0) * ${LEAF_WIND_FACTOR} * (0.5 + gust);
  transformed.x += sway * leafBend;
  transformed.z += cos(leafPhase * 0.85) * leafBend * 0.6;
  transformed.y -= abs(sway) * leafBend * 0.9;`;

function applyLeafWind(material: THREE.Material): void {
  material.onBeforeCompile = (shader): void => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\nattribute float aLeaf;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      LEAF_WIND_CHUNK,
    );
    material.userData.shader = shader;
  };
  material.needsUpdate = true;
}

export const InstancedFoliage = React.memo(({ map }: { map: GameMap }) => {
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
    const green = buildGreenSampler(texture);
    out[BUSH_SLOT] = buildFbxAsset(bush0, texture, { target: BUSH_TARGET, opacity: BUSH_OPACITY });
    out[BUSH_SLOT + 1] = buildFbxAsset(bush1, texture, { target: BUSH_TARGET, opacity: BUSH_OPACITY });
    out[TREE_SLOT] = buildFbxAsset(tree0, texture, { scale: TREE_SCALE, opacity: LEAF_OPACITY, wind: 'leaf', greenSampler: green });
    out[TREE_SLOT + 1] = buildFbxAsset(tree1, texture, { scale: TREE_SCALE, opacity: LEAF_OPACITY, wind: 'leaf', greenSampler: green });
    out[ROCK_SLOT] = buildFbxAsset(rock0, texture, { target: ROCK_TARGET });
    out[ROCK_SLOT + 1] = buildFbxAsset(rock1, texture, { target: ROCK_TARGET });
    out[ROCK_SLOT + 2] = buildFbxAsset(rock2, texture, { target: ROCK_TARGET });
    out[ROCK_SLOT + 3] = buildFbxAsset(rock3, texture, { target: ROCK_TARGET });
    const grassOpts = { target: GRASS_TARGET, opacity: GRASS_OPACITY, wind: 'grass' as const };
    out[GRASS_SLOT] = buildFbxAsset(grass0, texture, grassOpts);
    out[GRASS_SLOT + 1] = buildFbxAsset(grass1, texture, grassOpts);
    out[GRASS_SLOT + 2] = buildFbxAsset(grass2, texture, grassOpts);
    out[GRASS_SLOT + 3] = buildFbxAsset(grass3, texture, grassOpts);
    return out;
  }, [bush0, bush1, tree0, tree1, rock0, rock1, rock2, rock3, grass0, grass1, grass2, grass3, texture]);

  const recordGrassUniforms = useMemo(
    () => createSceneMetricRecorder('UnifiedMapScene:grass-uniform-update', 2),
    [],
  );

  useFrame((state) => {
    const startedAt = isSceneDebugEnabled() ? performance.now() : 0;
    for (const asset of slots) {
      const shader = asset?.material.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
      if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (startedAt > 0) recordGrassUniforms(performance.now() - startedAt);
  });

  const foliageList = useMemo(() => {
    const list: FoliageData[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.grid[y][x] as TerrainType;
        const props = TERRAIN_PROPERTIES[terrain];
        const seed = x * 1000 + y;

        if (terrain === TerrainType.WOOD) {
          list.push({ x, y, slot: TREE_SLOT + Math.floor(seededRandom(seed) * TREE_URLS.length), seed, ox: 0, oz: 0 });
        } else if (terrain === TerrainType.HERB) {
          list.push({ x, y, slot: BUSH_SLOT + Math.floor(seededRandom(seed) * BUSH_URLS.length), seed, ox: 0, oz: 0 });
        } else if (props.combatType === CombatTerrainType.WALL) {
          list.push({ x, y, slot: ROCK_SLOT + Math.floor(seededRandom(seed) * ROCK_VARIANTS), seed, ox: 0, oz: 0 });
        }
      }
    }
    buildGrass(list, map);
    return list;
  }, [map]);

  const counts = useMemo(() => {
    const out = new Array<number>(SLOT_COUNT).fill(0);
    for (const item of foliageList) out[item.slot]++;
    return out;
  }, [foliageList]);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const recordFoliageRebuild = useMemo(
    () => createSceneMetricRecorder('UnifiedMapScene:foliage-rebuild', 8),
    [],
  );

  useLayoutEffect(() => {
    const startedAt = isSceneDebugEnabled() ? performance.now() : 0;
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
      position.set(item.x - map.width / 2 + 0.5 + item.ox, 0, item.y - map.height / 2 + 0.5 + item.oz);
      euler.set(0, seededRandom(item.seed * 7) * Math.PI * 2, 0);
      rotation.setFromEuler(euler);
      scaleVec.set(s, s, s);
      matrix.compose(position, rotation, scaleVec);
      mesh.setMatrixAt(cursors[item.slot]++, matrix);
    }

    for (const mesh of meshRefs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
    if (startedAt > 0) recordFoliageRebuild(performance.now() - startedAt);
  }, [foliageList, slots, map, recordFoliageRebuild]);

  return (
    <group>
      {slots.map((asset, slot) =>
        asset && counts[slot] > 0 ? (
          <instancedMesh
            key={slot}
            ref={(el) => { meshRefs.current[slot] = el; }}
            args={[asset.geometry, asset.material, counts[slot]]}
            castShadow
            receiveShadow
            raycast={() => null}
          />
        ) : null,
      )}
    </group>
  );
});

for (const url of [...BUSH_URLS, ...TREE_URLS, ...ROCK_FBX_URLS, ...GRASS_URLS]) useFBX.preload(url);
useTexture.preload(TEXTURE_PATH);

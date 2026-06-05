import { extend } from '@react-three/fiber';
import React, { useRef, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';

import type { GameMap} from '@game/shared-types';
import { TerrainType, TERRAIN_PROPERTIES, CombatTerrainType } from '@game/shared-types';

import { fbm } from './noise';


extend({ RoundedBoxGeometry });

// World-space repeat of the procedural grain: lower = larger, softer terrain features.
const TERRAIN_TEX_SCALE = 0.15;

// Subtle FBM grayscale grain so tile tops read as terrain, not flat painted squares.
// Multiplied onto the per-instance colour, so the checker/terrain tint is preserved.
function makeTerrainTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Two scales: broad mottling (dirt patches) + fine grain (soil texture).
      const broad = fbm(x * 0.04, y * 0.04, 7);
      const grain = fbm(x * 0.2, y * 0.2, 23);
      const n = broad * 0.6 + grain * 0.4;
      const v = Math.floor((0.55 + n * 0.45) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Drive the grain UVs from world position so the texture flows across tiles continuously
// instead of repeating identically per cell (which would re-expose the grid).
function makeTerrainTopMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ map: makeTerrainTexture(), roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (shader): void => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      vec4 terrainWorld = modelMatrix * instanceMatrix * vec4( position, 1.0 );
      vMapUv = terrainWorld.xz * ${TERRAIN_TEX_SCALE.toFixed(3)};`,
    );
  };
  return mat;
}

interface RoundedBoxGeometryProps {
  args?: [width?: number, height?: number, depth?: number];
  radius?: number;
  smoothness?: number;
}

declare module '@react-three/fiber' {
  interface ThreeElements {
    roundedBoxGeometry: RoundedBoxGeometryProps;
  }
}

interface InstancedTerrainProps {
  map: GameMap;
  checkerColorA?: string;
  checkerColorB?: string;
  sideColor?: string;
  tileSize?: number;
  tileRadius?: number;
}

const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TerrainType.GROUND]: '#374151',
  [TerrainType.IRON]: '#78716c',
  [TerrainType.LEATHER]: '#92400e',
  [TerrainType.CRYSTAL]: '#7c3aed',
  [TerrainType.FABRIC]: '#a855f7',
  [TerrainType.WOOD]: '#166534',
  [TerrainType.HERB]: '#4ade80',
  [TerrainType.GOLD]: '#eab308',
  [TerrainType.WALL]: '#57534e',
};

export const InstancedTerrain = React.memo(({ 
  map, 
  checkerColorA, 
  checkerColorB, 
  sideColor = "#3c2415", 
  tileSize = 0.95, 
  tileRadius = 0.08 
}: InstancedTerrainProps) => {
  const meshRefA = useRef<THREE.InstancedMesh>(null);
  const meshRefB = useRef<THREE.InstancedMesh>(null);
  const topMaterial = useMemo(() => makeTerrainTopMaterial(), []);

  const getPos = React.useCallback((x: number, y: number): [number, number, number] => [
    x - map.width / 2 + 0.5,
    0,
    y - map.height / 2 + 0.5,
  ], [map.width, map.height]);

  useLayoutEffect(() => {
    if (!meshRefA.current || !meshRefB.current) return;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const sColor = new THREE.Color(sideColor);

    let idx = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.grid[y][x] as TerrainType;
        if (!terrain) {
          idx++;
          continue; 
        }
        
        const [wx, , wz] = getPos(x, y);

        // Sides (Box)
        matrix.makeTranslation(wx, -0.2, wz);
        meshRefA.current.setMatrixAt(idx, matrix);
        meshRefA.current.setColorAt(idx, sColor);

        // Top (Plane)
        matrix.makeRotationX(-Math.PI / 2);
        matrix.setPosition(wx, 0.01, wz); // Slight elevation to avoid z-fight
        meshRefB.current.setMatrixAt(idx, matrix);

        let baseColor = TERRAIN_COLORS[terrain] || '#374151';
        if (checkerColorA && checkerColorB) {
          baseColor = (x + y) % 2 === 0 ? checkerColorA : checkerColorB;
        } else if (TERRAIN_PROPERTIES[terrain]?.combatType === CombatTerrainType.HOLE) {
          baseColor = '#1a1a0f';
        }
        
        color.set(baseColor);
        meshRefB.current.setColorAt(idx, color);

        idx++;
      }
    }

    meshRefA.current.instanceMatrix.needsUpdate = true;
    if (meshRefA.current.instanceColor) meshRefA.current.instanceColor.needsUpdate = true;
    
    meshRefB.current.instanceMatrix.needsUpdate = true;
    if (meshRefB.current.instanceColor) meshRefB.current.instanceColor.needsUpdate = true;
  }, [map, checkerColorA, checkerColorB, sideColor, getPos]);

  const count = map.width * map.height;

  return (
    <group>
      {/* Sides of tiles */}
      <instancedMesh ref={meshRefA} args={[undefined, undefined, count]} raycast={() => null}>
        <roundedBoxGeometry args={[tileSize, 0.4, tileSize]} radius={tileRadius} smoothness={4} />
        <meshStandardMaterial />
      </instancedMesh>
      
      {/* Top surface of tiles */}
      <instancedMesh ref={meshRefB} args={[undefined, undefined, count]} raycast={() => null}>
        <planeGeometry args={[tileSize - 0.02, tileSize - 0.02]} />
        <primitive object={topMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
});

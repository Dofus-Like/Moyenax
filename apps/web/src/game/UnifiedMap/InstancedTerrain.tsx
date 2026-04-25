import { extend } from '@react-three/fiber';
import React, { useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';

import type { GameMap} from '@game/shared-types';
import { TerrainType, TERRAIN_PROPERTIES, CombatTerrainType } from '@game/shared-types';


extend({ RoundedBoxGeometry });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      roundedBoxGeometry: any;
    }
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

  const getPos = (x: number, y: number): [number, number, number] => [
    x - map.width / 2 + 0.5,
    0,
    y - map.height / 2 + 0.5
  ];

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
  }, [map, checkerColorA, checkerColorB, sideColor]);

  const count = map.width * map.height;

  return (
    <group>
      {/* Sides of tiles */}
      <instancedMesh ref={meshRefA} args={[null as any, null as any, count]} raycast={() => null}>
        <roundedBoxGeometry args={[tileSize, 0.4, tileSize]} radius={tileRadius} smoothness={4} />
        <meshStandardMaterial />
      </instancedMesh>
      
      {/* Top surface of tiles */}
      <instancedMesh ref={meshRefB} args={[null as any, null as any, count]} raycast={() => null}>
        <planeGeometry args={[tileSize - 0.02, tileSize - 0.02]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
});

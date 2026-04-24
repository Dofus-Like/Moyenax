import React from 'react';
import { TerrainType, TERRAIN_PROPERTIES, CombatTerrainType } from '@game/shared-types';

const TERRAIN_COLORS: Record<TerrainType, { base: string; hover: string }> = {
  [TerrainType.GROUND]: { base: '#374151', hover: '#4b5563' },
  [TerrainType.IRON]: { base: '#78716c', hover: '#a8a29e' },
  [TerrainType.LEATHER]: { base: '#92400e', hover: '#b45309' },
  [TerrainType.CRYSTAL]: { base: '#7c3aed', hover: '#a78bfa' },
  [TerrainType.FABRIC]: { base: '#a855f7', hover: '#c084fc' },
  [TerrainType.WOOD]: { base: '#166534', hover: '#22c55e' },
  [TerrainType.HERB]: { base: '#4ade80', hover: '#86efac' },
  [TerrainType.GOLD]: { base: '#eab308', hover: '#fde047' },
};

export interface TileHoverInfo {
  x: number;
  y: number;
  terrain: TerrainType;
}

export interface TerrainTileProps {
  x: number;
  y: number;
  terrain: TerrainType;
  gridSize: number;
  // Note: Click/Hover are now handled by the unified map hit plane for performance
  neighbors?: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

function WallObstacle({
  position,
  color,
  height,
  terrain,
  neighbors,
}: {
  position: [number, number, number];
  color: string;
  height: number;
  terrain: TerrainType;
  neighbors?: TerrainTileProps['neighbors'];
}) {
  const isMetal = terrain === TerrainType.IRON || terrain === TerrainType.GOLD;
  const isCrystal = terrain === TerrainType.CRYSTAL;

  const metalness = isMetal ? 0.8 : (isCrystal ? 0.3 : 0.1);
  const roughness = isMetal ? 0.4 : (isCrystal ? 0.2 : 0.7);

  const [x, , z] = position;

  const leftEdge = neighbors?.left ? -0.5 : -0.35;
  const rightEdge = neighbors?.right ? 0.5 : 0.35;
  const topEdge = neighbors?.top ? -0.5 : -0.35; 
  const bottomEdge = neighbors?.bottom ? 0.5 : 0.35;

  const width = rightEdge - leftEdge;
  const depth = bottomEdge - topEdge;
  const offsetX = (leftEdge + rightEdge) / 2;
  const offsetZ = (topEdge + bottomEdge) / 2;

  const hasNeighbors = !!(neighbors?.top || neighbors?.bottom || neighbors?.left || neighbors?.right);
  const isWood = terrain === TerrainType.WOOD;

  return (
    <mesh position={[x + offsetX, height / 2, z + offsetZ]} castShadow receiveShadow raycast={() => null}>
      {isWood && !hasNeighbors ? (
        <cylinderGeometry args={[0.35, 0.35, height, 8]} />
      ) : (
        <boxGeometry args={[width, height, depth]} />
      )}
      <meshStandardMaterial 
        color={color} 
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  );
}

function HoleTerrain({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group raycast={() => null}>
      <mesh position={[position[0], -0.15, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.82, 0.82]} />
        <meshStandardMaterial color={color} transparent opacity={0.8} />
      </mesh>
      <mesh position={[position[0], -0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.42, 12]} />
        <meshStandardMaterial color="#78350f" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function FlatResource({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={[position[0], 0.08, position[2]]} castShadow receiveShadow raycast={() => null}>
      <cylinderGeometry args={[0.25, 0.25, 0.08, 16]} />
      <meshStandardMaterial 
        color={color}
        metalness={0.1}
        roughness={0.8}
      />
    </mesh>
  );
}

/**
 * TerrainTile now ONLY renders visual decorations.
 * Interaction is delegated to the unified 'map-hit-plane' for 100% precision and performance.
 */
export const TerrainTile = React.memo(({ 
  x, y, terrain, gridSize, neighbors 
}: TerrainTileProps) => {
  const colors = TERRAIN_COLORS[terrain];
  const props = TERRAIN_PROPERTIES[terrain];

  const worldX = x - gridSize / 2 + 0.5;
  const worldZ = y - gridSize / 2 + 0.5;
  const pos: [number, number, number] = [worldX, 0, worldZ];

  return (
    <group userData={{ x, y, terrain, type: 'decoration' }}>
      {props.combatType === CombatTerrainType.WALL && terrain !== TerrainType.WOOD && (
        <WallObstacle
          position={pos}
          color={colors.base}
          height={0.6}
          terrain={terrain}
          neighbors={neighbors}
        />
      )}

      {props.combatType === CombatTerrainType.HOLE && (
        <HoleTerrain
          position={pos}
          color={colors.base}
        />
      )}

      {props.combatType === CombatTerrainType.FLAT && props.harvestable && terrain !== TerrainType.HERB && (
        <FlatResource
          position={pos}
          color={colors.base}
        />
      )}
    </group>
  );
});

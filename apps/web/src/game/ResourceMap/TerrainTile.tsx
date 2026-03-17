import React, { useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { TerrainType, TERRAIN_PROPERTIES } from '@game/shared-types';

const TERRAIN_COLORS: Record<TerrainType, { base: string; hover: string }> = {
  [TerrainType.GROUND]: { base: '#374151', hover: '#4b5563' },
  [TerrainType.WATER]: { base: '#1e40af', hover: '#2563eb' },
  [TerrainType.IRON_ORE]: { base: '#78716c', hover: '#a8a29e' },
  [TerrainType.GOLD_ORE]: { base: '#b45309', hover: '#d97706' },
  [TerrainType.WOOD]: { base: '#166534', hover: '#22c55e' },
  [TerrainType.HERB]: { base: '#4ade80', hover: '#86efac' },
  [TerrainType.CRYSTAL]: { base: '#7c3aed', hover: '#a78bfa' },
  [TerrainType.LEATHER]: { base: '#92400e', hover: '#b45309' },
};

export interface TileHoverInfo {
  x: number;
  y: number;
  terrain: TerrainType;
}

interface TerrainTileProps {
  x: number;
  y: number;
  terrain: TerrainType;
  gridSize: number;
  onTileClick?: (x: number, y: number, terrain: TerrainType) => void;
  onTileHover?: (info: TileHoverInfo | null) => void;
}

function WaterTile({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={[position[0], -0.05, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.92, 0.92]} />
      <meshStandardMaterial color="#1e40af" transparent opacity={0.7} />
    </mesh>
  );
}

function BlockingObstacle({
  position,
  color,
  height,
}: {
  position: [number, number, number];
  color: string;
  height: number;
}) {
  return (
    <mesh position={[position[0], height / 2, position[2]]}>
      <boxGeometry args={[0.7, height, 0.7]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function GroundDetail({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={[position[0], 0.05, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.25, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function TerrainTile({ x, y, terrain, gridSize, onTileClick, onTileHover }: TerrainTileProps) {
  const [hovered, setHovered] = useState(false);
  const colors = TERRAIN_COLORS[terrain];
  const props = TERRAIN_PROPERTIES[terrain];

  const worldX = x - gridSize / 2;
  const worldZ = y - gridSize / 2;
  const pos: [number, number, number] = [worldX, 0, worldZ];

  const tileColor = hovered ? colors.hover : colors.base;
  const isClickable = props.harvestable;

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    if (onTileHover) onTileHover({ x, y, terrain });
  };

  const handlePointerOut = () => {
    setHovered(false);
    if (onTileHover) onTileHover(null);
  };

  return (
    <group>
      <mesh
        position={[worldX, 0, worldZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (onTileClick) onTileClick(x, y, terrain);
        }}
      >
        <planeGeometry args={[0.92, 0.92]} />
        <meshStandardMaterial
          color={terrain === TerrainType.WATER ? '#1a2332' : tileColor}
        />
      </mesh>

      {terrain === TerrainType.WATER && <WaterTile position={pos} />}

      {terrain === TerrainType.IRON_ORE && (
        <BlockingObstacle position={pos} color={hovered ? '#a8a29e' : '#78716c'} height={0.6} />
      )}
      {terrain === TerrainType.GOLD_ORE && (
        <BlockingObstacle position={pos} color={hovered ? '#fbbf24' : '#d97706'} height={0.6} />
      )}
      {terrain === TerrainType.WOOD && (
        <BlockingObstacle position={pos} color={hovered ? '#22c55e' : '#166534'} height={1.0} />
      )}
      {terrain === TerrainType.CRYSTAL && (
        <BlockingObstacle position={pos} color={hovered ? '#c084fc' : '#7c3aed'} height={0.8} />
      )}

      {terrain === TerrainType.HERB && (
        <GroundDetail position={pos} color={hovered ? '#86efac' : '#4ade80'} />
      )}
      {terrain === TerrainType.LEATHER && (
        <GroundDetail position={pos} color={hovered ? '#d97706' : '#92400e'} />
      )}

      {hovered && isClickable && (
        <mesh position={[worldX, 0.01, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 16]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

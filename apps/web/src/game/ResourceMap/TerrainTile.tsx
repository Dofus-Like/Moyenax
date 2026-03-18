import React, { useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
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

interface TerrainTileProps {
  x: number;
  y: number;
  terrain: TerrainType;
  gridSize: number;
  onTileClick?: (x: number, y: number, terrain: TerrainType) => void;
  onTileHover?: (info: TileHoverInfo | null) => void;
  
  // Props optionnels pour le mode combat
  isReachable?: boolean;
  isInSpellRange?: boolean;
  previewColor?: string | null;
}

function WallObstacle({
  position,
  color,
  height,
  terrain,
}: {
  position: [number, number, number];
  color: string;
  height: number;
  terrain: TerrainType;
}) {
  // Propriétés différentes selon le type de ressource
  const isWood = terrain === TerrainType.WOOD;
  const isMetal = terrain === TerrainType.IRON || terrain === TerrainType.GOLD;
  const isCrystal = terrain === TerrainType.CRYSTAL;

  const metalness = isMetal ? 0.8 : (isCrystal ? 0.3 : 0.1);
  const roughness = isMetal ? 0.4 : (isCrystal ? 0.2 : 0.7);

  return (
    <mesh position={[position[0], height / 2, position[2]]} castShadow receiveShadow>
      {isWood ? (
        <cylinderGeometry args={[0.35, 0.35, height, 8]} />
      ) : (
        <boxGeometry args={[0.7, height, 0.7]} />
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
    <group>
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
    <mesh position={[position[0], 0.08, position[2]]} castShadow receiveShadow>
      <cylinderGeometry args={[0.25, 0.25, 0.08, 16]} />
      <meshStandardMaterial 
        color={color}
        metalness={0.1}
        roughness={0.8}
      />
    </mesh>
  );
}

export function TerrainTile({ x, y, terrain, gridSize, onTileClick, onTileHover, isReachable, isInSpellRange, previewColor }: TerrainTileProps) {
  const [hovered, setHovered] = useState(false);
  const colors = TERRAIN_COLORS[terrain];
  const props = TERRAIN_PROPERTIES[terrain];

  const worldX = x - gridSize / 2;
  const worldZ = y - gridSize / 2;
  const pos: [number, number, number] = [worldX, 0, worldZ];

  const tileColor = hovered ? colors.hover : colors.base;

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    if (onTileHover) onTileHover({ x, y, terrain });
  };

  const handlePointerOut = () => {
    setHovered(false);
    if (onTileHover) onTileHover(null);
  };

  const baseColor = props.combatType === CombatTerrainType.HOLE
    ? '#1a1a0f'
    : tileColor;

  return (
    <group>
      <mesh
        position={[worldX, 0, worldZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (onTileClick) onTileClick(x, y, terrain);
        }}
      >
        <planeGeometry args={[0.92, 0.92]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>

      {props.combatType === CombatTerrainType.WALL && (
        <WallObstacle
          position={pos}
          color={hovered ? colors.hover : colors.base}
          height={terrain === TerrainType.WOOD ? 1.0 : 0.6}
          terrain={terrain}
        />
      )}

      {props.combatType === CombatTerrainType.HOLE && (
        <HoleTerrain
          position={pos}
          color={hovered ? colors.hover : colors.base}
        />
      )}

      {props.combatType === CombatTerrainType.FLAT && props.harvestable && (
        <FlatResource
          position={pos}
          color={hovered ? colors.hover : colors.base}
        />
      )}

      {hovered && props.harvestable && (
        <mesh position={[worldX, 0.01, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 16]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Overlay de combat : chemin de prévisualisation */}
      {previewColor && (
        <mesh position={[worldX, 0.02, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 16]} />
          <meshBasicMaterial color={previewColor} transparent opacity={0.6} emissive={previewColor} emissiveIntensity={0.3} />
        </mesh>
      )}

      {/* Overlay de combat : tuile dans la portée d'un sort */}
      {isInSpellRange && (
        <mesh position={[worldX, 0.03, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 16]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.7} emissive="#ef4444" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
}

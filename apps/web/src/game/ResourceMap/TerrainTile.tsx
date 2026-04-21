import React from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { TerrainType, TERRAIN_PROPERTIES, CombatTerrainType } from '@game/shared-types';
import { Bush } from './Bush';
import { Tree } from './Tree';
import { Suspense } from 'react';
import { RoundedBox } from '@react-three/drei';

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
  onTileClick?: (x: number, y: number, terrain: TerrainType) => void;
  onTileHover?: (info: TileHoverInfo | null) => void;
  
  // Props optionnels pour le mode combat
  previewColor?: string | null;
  customColor?: string | null;
  sideColor?: string | null;
  tileSize?: number;
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

  const [x, y, z] = position;

  // Calcul des dimensions dynamiques pour unifier les murs
  const leftEdge = neighbors?.left ? -0.5 : -0.35;
  const rightEdge = neighbors?.right ? 0.5 : 0.35;
  const topEdge = neighbors?.top ? -0.5 : -0.35; // top is -Z in Three.js
  const bottomEdge = neighbors?.bottom ? 0.5 : 0.35; // bottom is +Z

  const width = rightEdge - leftEdge;
  const depth = bottomEdge - topEdge;
  const offsetX = (leftEdge + rightEdge) / 2;
  const offsetZ = (topEdge + bottomEdge) / 2;

  const hasNeighbors = !!(neighbors?.top || neighbors?.bottom || neighbors?.left || neighbors?.right);
  const isWood = terrain === TerrainType.WOOD;

  return (
    <mesh position={[x + offsetX, height / 2, z + offsetZ]} castShadow receiveShadow>
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

export const TerrainTile = React.memo(({ x, y, terrain, gridSize, onTileClick, previewColor, customColor, sideColor, tileSize = 0.95, tileRadius = 0.08, neighbors }: TerrainTileProps) => {
  const colors = TERRAIN_COLORS[terrain];
  const props = TERRAIN_PROPERTIES[terrain];

  const worldX = x - gridSize / 2 + 0.5;
  const worldZ = y - gridSize / 2 + 0.5;
  const pos: [number, number, number] = [worldX, 0, worldZ];

  const baseColor = customColor 
    ? customColor
    : (props.combatType === CombatTerrainType.HOLE ? '#1a1a0f' : colors.base);

  const finalSideColor = sideColor || "#3c2415";

  return (
    <group>
      {/* Sol épais arrondi (RoundedBox) */}
      <RoundedBox
        args={[tileSize, 0.4, tileSize]}
        radius={tileRadius}
        smoothness={4}
        position={[worldX, -0.2, worldZ]}
        receiveShadow
        userData={{ x, y, terrain, type: 'terrain-tile' }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (onTileClick) onTileClick(x, y, terrain);
        }}
      >
        <meshStandardMaterial color={finalSideColor} />
      </RoundedBox>

      {/* Surface supérieure pour le damier (légèrement au-dessus pour éviter le z-fighting) */}
      <mesh 
        position={[worldX, 0.001, worldZ]} 
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[tileSize - 0.02, tileSize - 0.02]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>

      {props.combatType === CombatTerrainType.WALL && terrain === TerrainType.WOOD && (
        <Suspense fallback={
          <mesh position={[worldX, 0.5, worldZ]} castShadow receiveShadow>
            <cylinderGeometry args={[0.35, 0.35, 1.0, 8]} />
            <meshStandardMaterial color={colors.base} />
          </mesh>
        }>
          <Tree position={[worldX, 0, worldZ]} scale={0.35} seed={x * 1000 + y} />
        </Suspense>
      )}

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

      {props.combatType === CombatTerrainType.FLAT && props.harvestable && (
        terrain === TerrainType.HERB ? (
          <Suspense fallback={
            <mesh position={[worldX, 0.04, worldZ]} castShadow>
              <boxGeometry args={[0.4, 0.08, 0.4]} />
              <meshStandardMaterial color="#4ade80" />
            </mesh>
          }>
            <Bush position={[worldX, 0, worldZ]} scale={1.0} seed={x * 1000 + y} />
          </Suspense>
        ) : (
          <FlatResource
            position={pos}
            color={colors.base}
          />
        )
      )}

      {/* Les effets de survol (hover) ne sont plus ici ! */}
      {previewColor && (
        <mesh position={[worldX, 0.02, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={previewColor} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
});

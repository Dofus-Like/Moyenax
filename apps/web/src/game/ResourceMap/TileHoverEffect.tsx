import React from 'react';
import { TerrainType, TERRAIN_PROPERTIES, CombatTerrainType } from '@game/shared-types';

interface TileHoverEffectProps {
  x: number;
  y: number;
  terrain: TerrainType;
  gridSize: number;
}

const HOVER_COLORS: Record<TerrainType, string> = {
  [TerrainType.GROUND]: '#4b5563',
  [TerrainType.IRON]: '#a8a29e',
  [TerrainType.LEATHER]: '#b45309',
  [TerrainType.CRYSTAL]: '#a78bfa',
  [TerrainType.FABRIC]: '#c084fc',
  [TerrainType.WOOD]: '#22c55e',
  [TerrainType.HERB]: '#86efac',
  [TerrainType.GOLD]: '#fde047',
};

export const TileHoverEffect = React.memo(({ x, y, terrain, gridSize }: TileHoverEffectProps) => {
  const worldX = x - gridSize / 2;
  const worldZ = y - gridSize / 2;
  const props = TERRAIN_PROPERTIES[terrain];
  const color = HOVER_COLORS[terrain];

  return (
    <group position={[worldX, 0, worldZ]}>
      {/* Surcouche de couleur (Overlay) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[0.92, 0.92]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>

      {/* Anneau de récolte si applicable */}
      {props.harvestable && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 16]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Visualisation spécifique pour les obstacles survolés */}
      {props.combatType === CombatTerrainType.WALL && (
        <mesh position={[0, terrain === TerrainType.WOOD ? 0.5 : 0.3, 0]} castShadow>
          {terrain === TerrainType.WOOD ? (
            <cylinderGeometry args={[0.36, 0.36, 1.01, 8]} />
          ) : (
            <boxGeometry args={[0.71, 0.61, 0.71]} />
          )}
          <meshBasicMaterial color={color} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
});

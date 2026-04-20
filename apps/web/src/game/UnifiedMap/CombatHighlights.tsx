import React from 'react';
import { COMBAT_COLORS } from '../constants/colors';

interface CombatHighlightProps {
  x: number;
  y: number;
  gridSize: number;
  type: 'reachable' | 'spell-range';
  tileSize?: number;
  pmColor?: string;
  rangeColor?: string;
  isHovered?: boolean;
}

export const CombatHighlight = React.memo(({ x, y, gridSize, type, tileSize = 1, pmColor, rangeColor, isHovered }: CombatHighlightProps) => {
  const worldX = x - gridSize / 2 + 0.5;
  const worldZ = y - gridSize / 2 + 0.5;

  if (type === 'spell-range') {
    return (
      <mesh position={[worldX, 0.03, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[tileSize, tileSize]} />
        <meshBasicMaterial color={rangeColor || COMBAT_COLORS.HP_RED} transparent opacity={0.6} />
        {isHovered && (
          <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[0.35, 0.45, 16]} />
            <meshBasicMaterial color={pmColor || COMBAT_COLORS.PM_VIOLET} transparent opacity={0.9} />
          </mesh>
        )}
      </mesh>
    );
  }

  return (
    <mesh position={[worldX, 0.015, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[tileSize, tileSize]} />
      <meshBasicMaterial color={pmColor || COMBAT_COLORS.PM_VIOLET} transparent opacity={0.9} />
    </mesh>
  );
});

interface CombatHighlightsLayerProps {
  reachableTiles: { x: number; y: number }[];
  spellRangeTiles: { x: number; y: number }[];
  pathTarget?: { x: number; y: number } | null;
  gridSize: number;
  tileSize?: number;
  pmColor?: string;
  rangeColor?: string;
  hoveredTile?: { x: number; y: number } | null;
}

export const CombatHighlightsLayer = React.memo(({ reachableTiles, spellRangeTiles, pathTarget, gridSize, tileSize = 1, pmColor, rangeColor, hoveredTile }: CombatHighlightsLayerProps) => {
  return (
    <group>
      {reachableTiles.map((t) => (
        <CombatHighlight key={`reach-${t.x}-${t.y}`} x={t.x} y={t.y} gridSize={gridSize} type="reachable" tileSize={tileSize} pmColor={pmColor} />
      ))}
      {spellRangeTiles.map((t) => (
        <CombatHighlight 
          key={`spell-${t.x}-${t.y}`} 
          x={t.x} 
          y={t.y} 
          gridSize={gridSize} 
          type="spell-range" 
          tileSize={tileSize} 
          rangeColor={rangeColor} 
          pmColor={pmColor}
          isHovered={hoveredTile?.x === t.x && hoveredTile?.y === t.y}
        />
      ))}
      {pathTarget && (
        <group position={[pathTarget.x - gridSize / 2 + 0.5, 0.04, pathTarget.y - gridSize / 2 + 0.5]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[tileSize, tileSize]} />
            <meshBasicMaterial color={pmColor || COMBAT_COLORS.PM_VIOLET} transparent opacity={0.9} />
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[0.35, 0.45, 16]} />
              <meshBasicMaterial color={rangeColor || COMBAT_COLORS.HP_RED} transparent opacity={0.9} />
            </mesh>
          </mesh>
        </group>
      )}
    </group>
  );
});

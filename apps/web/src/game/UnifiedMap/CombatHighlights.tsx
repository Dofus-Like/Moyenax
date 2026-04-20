import React from 'react';
import { COMBAT_COLORS } from '../constants/colors';

interface CombatHighlightProps {
  x: number;
  y: number;
  gridSize: number;
  type: 'reachable' | 'spell-range';
}

export const CombatHighlight = React.memo(({ x, y, gridSize, type }: CombatHighlightProps) => {
  const worldX = x - gridSize / 2 + 0.5;
  const worldZ = y - gridSize / 2 + 0.5;

  if (type === 'spell-range') {
    return (
      <mesh position={[worldX, 0.03, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.92, 0.92]} />
        <meshBasicMaterial color={COMBAT_COLORS.HP_RED} transparent opacity={0.4} />
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[0.4, 0.45, 16]} />
          <meshBasicMaterial color={COMBAT_COLORS.HP_RED} transparent opacity={0.8} />
        </mesh>
      </mesh>
    );
  }

  return (
    <mesh position={[worldX, 0.015, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.92, 0.92]} />
      <meshBasicMaterial color={COMBAT_COLORS.PM_VIOLET} transparent opacity={0.3} />
    </mesh>
  );
});

interface CombatHighlightsLayerProps {
  reachableTiles: { x: number; y: number }[];
  spellRangeTiles: { x: number; y: number }[];
  pathTarget?: { x: number; y: number } | null;
  gridSize: number;
}

export const CombatHighlightsLayer = React.memo(({ reachableTiles, spellRangeTiles, pathTarget, gridSize }: CombatHighlightsLayerProps) => {
  return (
    <group>
      {reachableTiles.map((t) => (
        <CombatHighlight key={`reach-${t.x}-${t.y}`} x={t.x} y={t.y} gridSize={gridSize} type="reachable" />
      ))}
      {spellRangeTiles.map((t) => (
        <CombatHighlight key={`spell-${t.x}-${t.y}`} x={t.x} y={t.y} gridSize={gridSize} type="spell-range" />
      ))}
      {pathTarget && (
        <group position={[pathTarget.x - gridSize / 2 + 0.5, 0.04, pathTarget.y - gridSize / 2 + 0.5]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.35, 32]} />
            <meshBasicMaterial color={COMBAT_COLORS.PA_YELLOW} transparent opacity={0.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <ringGeometry args={[0.35, 0.42, 32]} />
            <meshBasicMaterial color="white" transparent opacity={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
});

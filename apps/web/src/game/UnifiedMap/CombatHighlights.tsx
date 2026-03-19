import React from 'react';

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
        <meshBasicMaterial color="#ef4444" transparent opacity={0.4} />
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[0.4, 0.45, 16]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
        </mesh>
      </mesh>
    );
  }

  return (
    <mesh position={[worldX, 0.015, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.92, 0.92]} />
      <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
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
        <mesh 
          position={[pathTarget.x - gridSize / 2 + 0.5, 0.02, pathTarget.y - gridSize / 2 + 0.5]} 
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.3, 16]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
});

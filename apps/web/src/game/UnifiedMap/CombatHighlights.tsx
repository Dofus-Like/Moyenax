import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COMBAT_COLORS } from '../constants/colors';
import { Line } from '@react-three/drei';
import { calculateBoundaryEdges } from './unifiedMap.utils';

interface BoundaryOutlineProps {
  tiles: { x: number; y: number }[];
  gridSize: number;
  color: string;
  opacity?: number;
  width?: number;
  yOffset?: number;
}

const RisingHalo = React.memo(({ color, opacity = 0.6, height = 0.8, speed = 1.5 }: { color: string; opacity?: number; height?: number; speed?: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  
  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;
    const t = (clock.elapsedTime * speed) % 1; // 0 to 1 cycle
    
    meshRef.current.position.y = t * height;
    meshRef.current.scale.x = 1 + t * 0.3;
    meshRef.current.scale.z = 1 + t * 0.3;
    materialRef.current.opacity = (1 - t) * opacity;
  });

  return (
    <mesh ref={meshRef} rotation={[0, 0, 0]}>
      <cylinderGeometry args={[0.45, 0.45, 0.05, 16, 1, true]} />
      <meshBasicMaterial ref={materialRef} color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
});

export const BoundaryOutline = React.memo(({ tiles, gridSize, color, opacity = 1, width = 2, yOffset = 0.05 }: BoundaryOutlineProps) => {
  const edges = useMemo(() => {
    if (tiles.length === 0) return [];
    
    const rawEdges = calculateBoundaryEdges(tiles);
    const offset = -gridSize / 2 + 0.5;

    return rawEdges.map(edge => [
      [edge.start[0] + offset, yOffset, edge.start[1] + offset],
      [edge.end[0] + offset, yOffset, edge.end[1] + offset]
    ]);
  }, [tiles, gridSize, yOffset]);

  return (
    <group>
      {edges.map((points, i) => (
        <Line
          key={i}
          points={points}
          color={color}
          lineWidth={width}
          transparent
          opacity={opacity}
        />
      ))}
    </group>
  );
});

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
      <group position={[worldX, 0.03, worldZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[tileSize, tileSize]} />
          <meshBasicMaterial color={rangeColor || COMBAT_COLORS.HP_RED} transparent opacity={0.45} />
          {isHovered && (
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[0.35, 0.45, 16]} />
              <meshBasicMaterial color={pmColor || COMBAT_COLORS.PM_VIOLET} transparent opacity={0.9} />
            </mesh>
          )}
        </mesh>
        {isHovered && <RisingHalo color={pmColor || COMBAT_COLORS.PM_VIOLET} />}
      </group>
    );
  }

  return (
    <mesh position={[worldX, 0.015, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[tileSize, tileSize]} />
      <meshBasicMaterial color={pmColor || COMBAT_COLORS.PM_VIOLET} transparent opacity={0.45} />
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
      {/* Perimeter Outlines */}
      <BoundaryOutline 
        tiles={reachableTiles} 
        gridSize={gridSize} 
        color={pmColor || COMBAT_COLORS.PM_VIOLET} 
        yOffset={0.05}
        width={3}
      />
      <BoundaryOutline 
        tiles={spellRangeTiles} 
        gridSize={gridSize} 
        color={rangeColor || COMBAT_COLORS.HP_RED} 
        yOffset={0.06}
        width={3}
      />

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
            <meshBasicMaterial color={pmColor || COMBAT_COLORS.PM_VIOLET} transparent opacity={0.3} />
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[0.35, 0.45, 16]} />
              <meshBasicMaterial color={COMBAT_COLORS.PA_YELLOW} transparent opacity={0.9} />
            </mesh>
          </mesh>
          <RisingHalo color={COMBAT_COLORS.PA_YELLOW} speed={1.2} />
        </group>
      )}
    </group>
  );
});

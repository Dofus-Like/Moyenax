import React from 'react';
import { PathNode } from '@game/shared-types';
import { COMBAT_COLORS } from '../constants/colors';
import { BoundaryOutline } from '../UnifiedMap/CombatHighlights';

interface PathPreviewProps {
  path: PathNode[];
  gridSize: number;
  tileSize?: number;
  color?: string;
}

export const PathPreview = ({ path, gridSize, tileSize = 1, color }: PathPreviewProps) => {
  if (path.length === 0) return null;

  return (
    <group>
      <BoundaryOutline
        tiles={path}
        gridSize={gridSize}
        color={color || COMBAT_COLORS.PM_VIOLET}
        width={3}
        yOffset={0.07} // Slightly higher than range outlines
      />
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        if (isLast) return null; // Skip redundant target dot

        const wx = node.x - gridSize / 2 + 0.5;
        const wz = node.y - gridSize / 2 + 0.5;

        return (
          <mesh key={`path-${i}`} position={[wx, 0.02, wz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[tileSize, tileSize]} />
            <meshBasicMaterial
              color={color || COMBAT_COLORS.PM_VIOLET}
              transparent
              opacity={0.45}
            />
          </mesh>
        );
      })}
    </group>
  );
};

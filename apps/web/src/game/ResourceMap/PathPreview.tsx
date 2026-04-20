import React from 'react';
import { PathNode } from '@game/shared-types';
import { COMBAT_COLORS } from '../constants/colors';

interface PathPreviewProps {
  path: PathNode[];
  gridSize: number;
}

export function PathPreview({ path, gridSize }: PathPreviewProps) {
  if (path.length === 0) return null;

  return (
    <group>
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        if (isLast) return null; // Skip redundant target dot

        const wx = node.x - gridSize / 2 + 0.5;
        const wz = node.y - gridSize / 2 + 0.5;

        return (
          <mesh
            key={`path-${i}`}
            position={[wx, 0.02, wz]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.1, 12]} />
            <meshBasicMaterial
              color={COMBAT_COLORS.PM_VIOLET}
              transparent
              opacity={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

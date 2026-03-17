import React from 'react';
import { PathNode } from '@game/shared-types';

interface PathPreviewProps {
  path: PathNode[];
  gridSize: number;
}

export function PathPreview({ path, gridSize }: PathPreviewProps) {
  if (path.length === 0) return null;

  return (
    <group>
      {path.map((node, i) => {
        const wx = node.x - gridSize / 2;
        const wz = node.y - gridSize / 2;
        const isLast = i === path.length - 1;

        return (
          <mesh
            key={`path-${i}`}
            position={[wx, 0.02, wz]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[isLast ? 0.2 : 0.1, 12]} />
            <meshBasicMaterial
              color={isLast ? '#22c55e' : '#6366f1'}
              transparent
              opacity={0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
}

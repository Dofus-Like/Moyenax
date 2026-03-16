import React, { useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

const GRID_SIZE = 20;

function Tile({ position, hasResource, onGather }: {
  position: [number, number, number];
  hasResource: boolean;
  onGather: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const color = hasResource
    ? hovered ? '#22c55e' : '#16a34a'
    : hovered ? '#4b5563' : '#374151';

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (hasResource) onGather();
      }}
    >
      <planeGeometry args={[0.9, 0.9]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function ResourceMapScene() {
  const [resources, setResources] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(Math.random() * GRID_SIZE);
      const y = Math.floor(Math.random() * GRID_SIZE);
      set.add(`${x},${y}`);
    }
    return set;
  });

  const handleGather = (x: number, y: number) => {
    setResources((prev) => {
      const next = new Set(prev);
      next.delete(`${x},${y}`);
      return next;
    });
  };

  const tiles = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const hasResource = resources.has(`${x},${y}`);
      tiles.push(
        <Tile
          key={`${x}-${y}`}
          position={[x - GRID_SIZE / 2, 0, y - GRID_SIZE / 2]}
          hasResource={hasResource}
          onGather={() => handleGather(x, y)}
        />,
      );
    }
  }

  return <group>{tiles}</group>;
}

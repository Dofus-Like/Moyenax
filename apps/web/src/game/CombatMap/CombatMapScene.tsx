import React, { useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useCombatStore } from '../../store/combat.store';

const GRID_SIZE = 10;

function CombatTile({ position, isReachable, isTarget, onClick }: {
  position: [number, number, number];
  isReachable: boolean;
  isTarget: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  let color = '#1f2937';
  if (isReachable) color = hovered ? '#60a5fa' : '#3b82f6';
  else if (isTarget) color = hovered ? '#f87171' : '#ef4444';
  else if (hovered) color = '#374151';

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <planeGeometry args={[0.9, 0.9]} />
      <meshStandardMaterial color={color} transparent opacity={0.8} />
    </mesh>
  );
}

function PlayerMesh({ position, color }: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position}>
      <capsuleGeometry args={[0.2, 0.5, 8, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function CombatMapScene() {
  const combatState = useCombatStore((s) => s.combatState);

  const tiles = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const isObstacle = combatState?.map.obstacles.some(
        (o) => o.x === x && o.y === y,
      );

      if (isObstacle) {
        tiles.push(
          <mesh key={`obs-${x}-${y}`} position={[x, 0.25, y]}>
            <boxGeometry args={[0.8, 0.5, 0.8]} />
            <meshStandardMaterial color="#78716c" />
          </mesh>,
        );
      } else {
        tiles.push(
          <CombatTile
            key={`${x}-${y}`}
            position={[x, 0, y]}
            isReachable={false}
            isTarget={false}
            onClick={() => { /* Géré par le HUD */ }}
          />,
        );
      }
    }
  }

  const players = combatState
    ? Object.values(combatState.players).map((p, i) => (
        <PlayerMesh
          key={p.playerId}
          position={[p.position.x, 0.5, p.position.y]}
          color={i === 0 ? '#6366f1' : '#f59e0b'}
        />
      ))
    : null;

  return (
    <group>
      {tiles}
      {players}
    </group>
  );
}

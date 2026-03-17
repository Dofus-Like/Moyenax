import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PathNode } from '@game/shared-types';

const MOVE_SPEED = 4.5;
const BOUNCE_HEIGHT = 0.15;
const PAWN_COLOR = '#6366f1';
const PAWN_EMISSIVE = '#4338ca';

interface PlayerPawnProps {
  gridPosition: PathNode;
  gridSize: number;
  path: PathNode[] | null;
  onPathComplete: () => void;
}

function toWorld(gx: number, gy: number, gridSize: number): [number, number, number] {
  return [gx - gridSize / 2, 0, gy - gridSize / 2];
}

export function PlayerPawn({ gridPosition, gridSize, path, onPathComplete }: PlayerPawnProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const [currentPath, setCurrentPath] = useState<PathNode[]>([]);
  const [pathIndex, setPathIndex] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const progressRef = useRef(0);
  const fromRef = useRef<[number, number, number]>(toWorld(gridPosition.x, gridPosition.y, gridSize));
  const toRef = useRef<[number, number, number]>(toWorld(gridPosition.x, gridPosition.y, gridSize));

  useEffect(() => {
    if (path && path.length > 0) {
      setCurrentPath(path);
      setPathIndex(0);
      setIsMoving(true);
      progressRef.current = 0;
      const [wx, , wz] = groupRef.current
        ? [groupRef.current.position.x, 0, groupRef.current.position.z]
        : toWorld(gridPosition.x, gridPosition.y, gridSize);
      fromRef.current = [wx, 0, wz];
      toRef.current = toWorld(path[0].x, path[0].y, gridSize);
    }
  }, [path]);

  useEffect(() => {
    if (!isMoving && currentPath.length === 0) {
      const [wx, , wz] = toWorld(gridPosition.x, gridPosition.y, gridSize);
      if (groupRef.current) {
        groupRef.current.position.set(wx, 0, wz);
      }
    }
  }, [gridPosition, gridSize, isMoving, currentPath.length]);

  useFrame((_, delta) => {
    if (!isMoving || !groupRef.current || currentPath.length === 0) return;

    progressRef.current += delta * MOVE_SPEED;
    const t = Math.min(progressRef.current, 1);

    const from = fromRef.current;
    const to = toRef.current;
    const x = THREE.MathUtils.lerp(from[0], to[0], t);
    const z = THREE.MathUtils.lerp(from[2], to[2], t);
    const bounce = Math.sin(t * Math.PI) * BOUNCE_HEIGHT;

    groupRef.current.position.set(x, bounce, z);

    if (t >= 1) {
      const nextIndex = pathIndex + 1;
      if (nextIndex < currentPath.length) {
        fromRef.current = [...toRef.current];
        toRef.current = toWorld(currentPath[nextIndex].x, currentPath[nextIndex].y, gridSize);
        setPathIndex(nextIndex);
        progressRef.current = 0;
      } else {
        groupRef.current.position.set(to[0], 0, to[2]);
        setIsMoving(false);
        setCurrentPath([]);
        setPathIndex(0);
        onPathComplete();
      }
    }
  });

  const initialWorld = toWorld(gridPosition.x, gridPosition.y, gridSize);

  return (
    <group ref={groupRef} position={initialWorld}>
      <mesh ref={bodyRef} position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.18, 0.3, 8, 16]} />
        <meshStandardMaterial
          color={PAWN_COLOR}
          emissive={PAWN_EMISSIVE}
          emissiveIntensity={0.3}
          metalness={0.2}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial
          color={PAWN_COLOR}
          emissive={PAWN_EMISSIVE}
          emissiveIntensity={0.3}
          metalness={0.2}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

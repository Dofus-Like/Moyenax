import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import { useCallback, useRef } from 'react';
import { Quaternion, Vector3, type Group } from 'three';

import {
  ARRIVAL_THRESHOLD,
  NAVIGATION_RADIUS,
  PLAYER_SPEED,
  ROTATION_LERP_RATE,
} from './constants';

interface UseClickToMoveOptions<TMeta> {
  playerRef: RefObject<Group | null>;
  snapY?: (x: number, z: number) => number;
  onArrive?: (metadata: TMeta | null) => void;
}

interface UseClickToMoveResult<TMeta> {
  setTarget: (point: Vector3, metadata?: TMeta | null) => void;
}

interface InternalTarget<TMeta> {
  point: Vector3;
  metadata: TMeta | null;
}

const UP_AXIS = new Vector3(0, 1, 0);
const SHARED_DIR = new Vector3();
const SHARED_QUAT = new Quaternion();

export function clampToNavigation(point: Vector3): Vector3 {
  const distance = Math.hypot(point.x, point.z);
  if (distance > NAVIGATION_RADIUS && distance > 0) {
    const factor = NAVIGATION_RADIUS / distance;
    point.x *= factor;
    point.z *= factor;
  }
  return point;
}

interface StepCallbacks<TMeta> {
  onArrive?: (metadata: TMeta | null) => void;
  clearTarget: () => void;
  snapY?: (x: number, z: number) => number;
}

export function stepTowardTarget<TMeta>(
  player: Group,
  target: InternalTarget<TMeta>,
  delta: number,
  callbacks: StepCallbacks<TMeta>,
): void {
  SHARED_DIR.set(target.point.x - player.position.x, 0, target.point.z - player.position.z);
  const distance = SHARED_DIR.length();

  if (distance < ARRIVAL_THRESHOLD) {
    player.position.x = target.point.x;
    player.position.z = target.point.z;
    if (callbacks.snapY) player.position.y = callbacks.snapY(player.position.x, player.position.z);
    const arrivedMeta = target.metadata;
    callbacks.clearTarget();
    callbacks.onArrive?.(arrivedMeta);
    return;
  }

  SHARED_DIR.divideScalar(distance);
  const step = Math.min(PLAYER_SPEED * delta, distance);
  player.position.x += SHARED_DIR.x * step;
  player.position.z += SHARED_DIR.z * step;
  if (callbacks.snapY) player.position.y = callbacks.snapY(player.position.x, player.position.z);

  const angle = Math.atan2(SHARED_DIR.x, SHARED_DIR.z);
  SHARED_QUAT.setFromAxisAngle(UP_AXIS, angle);
  player.quaternion.slerp(SHARED_QUAT, Math.min(1, ROTATION_LERP_RATE * delta));
}

export function useClickToMove<TMeta = unknown>({
  playerRef,
  snapY,
  onArrive,
}: UseClickToMoveOptions<TMeta>): UseClickToMoveResult<TMeta> {
  const targetRef = useRef<InternalTarget<TMeta> | null>(null);

  const setTarget = useCallback((point: Vector3, metadata: TMeta | null = null): void => {
    const clamped = clampToNavigation(point.clone());
    if (snapY) clamped.y = snapY(clamped.x, clamped.z);
    targetRef.current = { point: clamped, metadata };
  }, [snapY]);

  useFrame((_, delta): void => {
    const player = playerRef.current;
    const target = targetRef.current;
    if (!player || !target) return;
    stepTowardTarget(player, target, delta, {
      onArrive,
      snapY,
      clearTarget: (): void => {
        targetRef.current = null;
      },
    });
  });

  return { setTarget };
}

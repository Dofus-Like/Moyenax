import { Group, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { ARRIVAL_THRESHOLD, NAVIGATION_RADIUS, PLAYER_SPEED } from './constants';
import { clampToNavigation, stepTowardTarget } from './useClickToMove';

interface StepArgs<T> {
  player: Group;
  target: { point: Vector3; metadata: T | null };
  delta: number;
  onArrive?: (meta: T | null) => void;
  snapY?: (x: number, z: number) => number;
}

function makePlayer(x = 0, z = 0, y = 0): Group {
  const g = new Group();
  g.position.set(x, y, z);
  return g;
}

function step<T>({ player, target, delta, onArrive, snapY }: StepArgs<T>): { cleared: boolean } {
  let cleared = false;
  stepTowardTarget(player, target, delta, {
    onArrive,
    snapY,
    clearTarget: () => { cleared = true; },
  });
  return { cleared };
}

describe('clampToNavigation', () => {
  it('keeps points inside the navigation radius unchanged', () => {
    const p = new Vector3(3, 0, 4);
    const result = clampToNavigation(p);
    expect(result.x).toBe(3);
    expect(result.z).toBe(4);
  });

  it('projects out-of-radius points back onto the radius', () => {
    const p = new Vector3(NAVIGATION_RADIUS + 5, 0, 0);
    const result = clampToNavigation(p);
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(NAVIGATION_RADIUS, 6);
  });

  it('handles diagonal vectors past the radius', () => {
    const p = new Vector3(20, 0, 20);
    const result = clampToNavigation(p);
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(NAVIGATION_RADIUS, 6);
    expect(result.x / result.z).toBeCloseTo(1, 6);
  });

  it('handles the origin without dividing by zero', () => {
    const p = new Vector3(0, 0, 0);
    const result = clampToNavigation(p);
    expect(result.x).toBe(0);
    expect(result.z).toBe(0);
  });
});

describe('stepTowardTarget', () => {
  it('advances towards the target without overshooting', () => {
    const player = makePlayer(0, 0);
    const target = { point: new Vector3(10, 0, 0), metadata: null };
    const delta = 0.1;
    step({ player, target, delta });
    const expected = Math.min(PLAYER_SPEED * delta, 10);
    expect(player.position.x).toBeCloseTo(expected, 6);
    expect(player.position.z).toBeCloseTo(0, 6);
  });

  it('snaps to target and fires onArrive once when within ARRIVAL_THRESHOLD', () => {
    const player = makePlayer(5, 0);
    const target = { point: new Vector3(5 + ARRIVAL_THRESHOLD / 2, 0, 0), metadata: 'combat' };
    const onArrive = vi.fn();
    const result = step({ player, target, delta: 1 / 60, onArrive });
    expect(result.cleared).toBe(true);
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(onArrive).toHaveBeenCalledWith('combat');
    expect(player.position.x).toBe(target.point.x);
    expect(player.position.z).toBe(target.point.z);
  });

  it('does not call onArrive while still moving', () => {
    const player = makePlayer(0, 0);
    const target = { point: new Vector3(10, 0, 0), metadata: 'vs-ai' };
    const onArrive = vi.fn();
    const result = step({ player, target, delta: 0.01, onArrive });
    expect(result.cleared).toBe(false);
    expect(onArrive).not.toHaveBeenCalled();
  });

  it('passes null metadata when arriving on a ground click', () => {
    const player = makePlayer(0, 0);
    const target = { point: new Vector3(0, 0, 0), metadata: null };
    const onArrive = vi.fn();
    step({ player, target, delta: 1 / 60, onArrive });
    expect(onArrive).toHaveBeenCalledWith(null);
  });

  it('preserves POI metadata until the player actually arrives', () => {
    const player = makePlayer(0, 0);
    const target = { point: new Vector3(10, 0, 0), metadata: 'rooms' };
    const onArrive = vi.fn();
    for (let i = 0; i < 100; i++) {
      step({ player, target, delta: 0.1, onArrive });
      if (onArrive.mock.calls.length > 0) break;
    }
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(onArrive).toHaveBeenCalledWith('rooms');
  });

  it('uses snapY to keep player y aligned with the ground', () => {
    const player = makePlayer(0, 0);
    const target = { point: new Vector3(5, 0, 0), metadata: null };
    const snapY = vi.fn((x: number, _z: number) => x * 0.1);
    step({ player, target, delta: 0.05, snapY });
    expect(snapY).toHaveBeenCalled();
    expect(player.position.y).toBeCloseTo(player.position.x * 0.1, 6);
  });

  it('rotates the player to face the movement direction', () => {
    const player = makePlayer(0, 0);
    const target = { point: new Vector3(10, 0, 0), metadata: null };
    step({ player, target, delta: 0.5 });
    expect(player.quaternion.y).not.toBe(0);
  });
});

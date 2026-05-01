import { Vector3 } from 'three';

export function computePoiStopPoint(
  playerPos: Vector3,
  poiPos: Vector3,
  stopDistance: number,
): Vector3 {
  const dx = poiPos.x - playerPos.x;
  const dz = poiPos.z - playerPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= stopDistance) {
    return playerPos.clone();
  }
  const factor = (dist - stopDistance) / dist;
  return new Vector3(playerPos.x + dx * factor, 0, playerPos.z + dz * factor);
}

export function shouldTreatPointerAsDrag(distance: number, thresholdPx: number): boolean {
  return distance > thresholdPx;
}

export function clampElevation(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampZoom(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

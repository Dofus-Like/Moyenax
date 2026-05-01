import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  CAMERA_ORBIT_MAX_ELEVATION,
  CAMERA_ORBIT_MIN_ELEVATION,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  POI_STOP_DISTANCE,
} from './constants';
import {
  clampElevation,
  clampZoom,
  computePoiStopPoint,
  shouldTreatPointerAsDrag,
} from './movement';

describe('computePoiStopPoint', () => {
  it('keeps the stop point on the player→POI line', () => {
    const player = new Vector3(0, 0, 0);
    const poi = new Vector3(8, 0, 0);
    const stop = computePoiStopPoint(player, poi, POI_STOP_DISTANCE);
    expect(stop.z).toBeCloseTo(0, 6);
    expect(stop.x).toBeCloseTo(8 - POI_STOP_DISTANCE, 6);
  });

  it('respects POI_STOP_DISTANCE in any direction', () => {
    for (const poi of [
      new Vector3(0, 0, 8),
      new Vector3(-7.5, 0, -1.5),
      new Vector3(3, 0, -4),
    ]) {
      const player = new Vector3(0, 0, 0);
      const stop = computePoiStopPoint(player, poi, POI_STOP_DISTANCE);
      const distance = Math.hypot(poi.x - stop.x, poi.z - stop.z);
      expect(distance).toBeCloseTo(POI_STOP_DISTANCE, 6);
    }
  });

  it('returns a clone of the player position when already inside the stop ring', () => {
    const player = new Vector3(7.5, 0, 0);
    const poi = new Vector3(8, 0, 0);
    const stop = computePoiStopPoint(player, poi, POI_STOP_DISTANCE);
    expect(stop.x).toBeCloseTo(player.x, 6);
    expect(stop.z).toBeCloseTo(player.z, 6);
    expect(stop).not.toBe(player);
  });

  it('does not produce NaN when player and POI overlap', () => {
    const player = new Vector3(0, 0, 0);
    const poi = new Vector3(0, 0, 0);
    const stop = computePoiStopPoint(player, poi, POI_STOP_DISTANCE);
    expect(Number.isFinite(stop.x)).toBe(true);
    expect(Number.isFinite(stop.z)).toBe(true);
  });

  it('forces y=0 on the returned stop point', () => {
    const player = new Vector3(0, 5, 0);
    const poi = new Vector3(8, 0, 0);
    const stop = computePoiStopPoint(player, poi, POI_STOP_DISTANCE);
    expect(stop.y).toBe(0);
  });
});

describe('shouldTreatPointerAsDrag', () => {
  it('returns false at or below the threshold', () => {
    expect(shouldTreatPointerAsDrag(0, 5)).toBe(false);
    expect(shouldTreatPointerAsDrag(5, 5)).toBe(false);
  });

  it('returns true above the threshold', () => {
    expect(shouldTreatPointerAsDrag(5.0001, 5)).toBe(true);
    expect(shouldTreatPointerAsDrag(50, 5)).toBe(true);
  });
});

describe('clampElevation', () => {
  it('clamps to the configured min/max orbit range', () => {
    const min = CAMERA_ORBIT_MIN_ELEVATION;
    const max = CAMERA_ORBIT_MAX_ELEVATION;
    expect(clampElevation(-1, min, max)).toBe(min);
    expect(clampElevation(10, min, max)).toBe(max);
    expect(clampElevation((min + max) / 2, min, max)).toBeCloseTo((min + max) / 2);
  });
});

describe('clampZoom', () => {
  it('clamps to the configured min/max zoom range', () => {
    expect(clampZoom(0, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX)).toBe(CAMERA_ZOOM_MIN);
    expect(clampZoom(9999, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX)).toBe(CAMERA_ZOOM_MAX);
    expect(clampZoom(40, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX)).toBe(40);
  });
});

import { describe, expect, it } from 'vitest';

import { TerrainType } from '@game/shared-types';

import type { FoliageData } from './InstancedFoliage';
import { buildGrass, hashMap, isTileWalkable } from './InstancedFoliage';

// Minimal GameMap builder for tests.
function makeMap(grid: TerrainType[][]): { width: number; height: number; grid: TerrainType[][]; seedId: string } {
  return { width: grid[0].length, height: grid.length, grid, seedId: 'FORGE' as unknown as string };
}

const GROUND = TerrainType.GROUND;

describe('isTileWalkable', () => {
  const map = makeMap([
    [GROUND, GROUND],
    [GROUND, TerrainType.GOLD],
  ]);

  it('returns true for GROUND', () => {
    expect(isTileWalkable(map, 0, 0)).toBe(true);
  });

  it('returns false for HOLE terrain (GOLD)', () => {
    expect(isTileWalkable(map, 1, 1)).toBe(false);
  });

  it('returns false out of bounds', () => {
    expect(isTileWalkable(map, -1, 0)).toBe(false);
    expect(isTileWalkable(map, 0, 5)).toBe(false);
    expect(isTileWalkable(map, 99, 0)).toBe(false);
  });
});

describe('hashMap', () => {
  const mapA = makeMap([[GROUND, GROUND], [GROUND, GROUND]]);
  const mapB = makeMap([[GROUND, TerrainType.HERB], [GROUND, GROUND]]);

  it('returns positive integer', () => {
    const h = hashMap(mapA);
    expect(h).toBeGreaterThan(0);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('is deterministic', () => {
    expect(hashMap(mapA)).toBe(hashMap(mapA));
  });

  it('different maps produce different hashes', () => {
    expect(hashMap(mapA)).not.toBe(hashMap(mapB));
  });

  it('maps with swapped dimensions differ', () => {
    const mapC = makeMap([[GROUND, GROUND, GROUND], [GROUND, GROUND, GROUND]]);
    const mapD = makeMap([[GROUND, GROUND], [GROUND, GROUND], [GROUND, GROUND]]);
    expect(hashMap(mapC)).not.toBe(hashMap(mapD));
  });
});

describe('buildGrass', () => {
  const map = makeMap([
    [GROUND, GROUND, GROUND, GROUND, GROUND],
    [GROUND, GROUND, GROUND, GROUND, GROUND],
    [GROUND, GROUND, GROUND, GROUND, GROUND],
    [GROUND, GROUND, GROUND, GROUND, GROUND],
    [GROUND, GROUND, GROUND, GROUND, GROUND],
  ]);

  it('produces blades on a walkable map', () => {
    const list: FoliageData[] = [];
    buildGrass(list, map);
    expect(list.length).toBeGreaterThan(0);
  });

  it('is deterministic — same map → identical list', () => {
    const a: FoliageData[] = [];
    const b: FoliageData[] = [];
    buildGrass(a, map);
    buildGrass(b, map);
    expect(a).toEqual(b);
  });

  it('different maps → different placement', () => {
    const map2 = makeMap([
      [GROUND, GROUND, TerrainType.HERB, GROUND, GROUND],
      [GROUND, GROUND, GROUND, GROUND, GROUND],
      [GROUND, GROUND, GROUND, GROUND, GROUND],
      [GROUND, GROUND, GROUND, GROUND, GROUND],
      [GROUND, GROUND, GROUND, GROUND, GROUND],
    ]);
    const a: FoliageData[] = [];
    const b: FoliageData[] = [];
    buildGrass(a, map);
    buildGrass(b, map2);
    // Different maps → different first blade (or different count)
    const aStr = JSON.stringify(a[0]);
    const bStr = JSON.stringify(b[0]);
    expect(aStr).not.toBe(bStr);
  });

  it('all blades placed on walkable tiles', () => {
    const list: FoliageData[] = [];
    buildGrass(list, map);
    for (const blade of list) {
      expect(isTileWalkable(map, blade.x, blade.y)).toBe(true);
    }
  });

  it('blade tile coords are within map bounds', () => {
    const list: FoliageData[] = [];
    buildGrass(list, map);
    for (const blade of list) {
      expect(blade.x).toBeGreaterThanOrEqual(0);
      expect(blade.x).toBeLessThan(map.width);
      expect(blade.y).toBeGreaterThanOrEqual(0);
      expect(blade.y).toBeLessThan(map.height);
    }
  });

  it('produces no blades on all-HOLE map', () => {
    const holeMap = makeMap([
      [TerrainType.GOLD, TerrainType.GOLD, TerrainType.GOLD],
      [TerrainType.GOLD, TerrainType.GOLD, TerrainType.GOLD],
      [TerrainType.GOLD, TerrainType.GOLD, TerrainType.GOLD],
    ]);
    const list: FoliageData[] = [];
    buildGrass(list, holeMap);
    expect(list.length).toBe(0);
  });
});

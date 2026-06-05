import { describe, expect, it } from 'vitest';

import { TerrainType } from '@game/shared-types';

import { terrainToMap, worldToCell } from './terrainGrid';

describe('worldToCell', () => {
  it('mappe le centre du monde vers la cellule centrale (11×11)', () => {
    expect(worldToCell(0, 0, 11, 11)).toEqual([5, 5]);
  });

  it('mappe le coin', () => {
    expect(worldToCell(-5, -5, 11, 11)).toEqual([0, 0]);
  });

  it('renvoie null hors grille', () => {
    expect(worldToCell(100, 0, 11, 11)).toBeNull();
  });
});

describe('terrainToMap', () => {
  it('utilise la grille peinte si présente', () => {
    const grid = [[TerrainType.WALL, TerrainType.GROUND]];
    const map = terrainToMap({ width: 2, height: 1, seedId: 'NATURE', grid });
    expect(map.grid).toBe(grid);
  });

  it('génère depuis le seed si pas de grille', () => {
    const map = terrainToMap({ width: 11, height: 11, seedId: 'FORGE' });
    expect(map.grid).toHaveLength(11);
  });
});

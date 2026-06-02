import { describe, it, expect } from 'vitest';

import { TerrainType } from '@game/shared-types';

import { countRemainingResources } from './farming';

function makeGrid(rows: string[]): TerrainType[][] {
  const map: Record<string, TerrainType> = {
    G: TerrainType.GROUND,
    I: TerrainType.IRON,
    L: TerrainType.LEATHER,
    C: TerrainType.CRYSTAL,
    F: TerrainType.FABRIC,
    W: TerrainType.WOOD,
    H: TerrainType.HERB,
    O: TerrainType.GOLD,
  };
  return rows.map((row) => row.split('').map((c) => map[c] ?? TerrainType.GROUND));
}

describe('countRemainingResources', () => {
  it('compte les ressources restantes pour une seed FORGE', () => {
    const grid = makeGrid([
      'GIIII',
      'GLLLG',
      'GGGGG',
    ]);

    const result = countRemainingResources(grid, 'FORGE');

    expect(result).toEqual(
      expect.arrayContaining([
        { name: 'Fer', count: 4 },
        { name: 'Cuir', count: 3 },
      ]),
    );
  });

  it('ignore GOLD (Or) dans le résultat', () => {
    const grid = makeGrid([
      'OGGGG',
      'GGGGG',
    ]);

    const result = countRemainingResources(grid, 'FORGE');

    expect(result.find((r) => r.name === 'Or')).toBeUndefined();
  });

  it('retourne 0 pour une ressource absente de la grille', () => {
    const grid = makeGrid([
      'GGGGG',
      'GGGGG',
    ]);

    const result = countRemainingResources(grid, 'FORGE');

    expect(result.every((r) => r.count === 0)).toBe(true);
  });

  it('retourne tableau vide pour une seed inconnue', () => {
    const grid = makeGrid([
      'GGGGG',
      'GGGGG',
    ]);

    const result = countRemainingResources(grid, 'INVALID' as never);

    expect(result).toEqual([]);
  });

  it('compte correctement avec une seed multi-familles (FORGE_ARCANE)', () => {
    const grid = makeGrid([
      'ICCFG',
      'LLFFG',
      'GGGGG',
    ]);

    const result = countRemainingResources(grid, 'FORGE_ARCANE');

    expect(result).toEqual(
      expect.arrayContaining([
        { name: 'Fer', count: 1 },
        { name: 'Cuir', count: 2 },
        { name: 'Cristal magique', count: 2 },
        { name: 'Étoffe', count: 3 },
      ]),
    );
  });

  it('ne compte que les cellules du terrain exact, pas les autres types', () => {
    const grid = makeGrid([
      'ICFW',
      'GGGG',
    ]);

    const result = countRemainingResources(grid, 'FORGE_ARCANE');

    const fer = result.find((r) => r.name === 'Fer');
    expect(fer?.count).toBe(1);
  });
});

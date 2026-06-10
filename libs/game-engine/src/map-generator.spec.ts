import { ALL_SEED_IDS, MAP_SIZE, TERRAIN_PROPERTIES, TerrainType } from '@game/shared-types';

import { ensureConnectivity, generateMap, isConnected } from './map-generator';

function barrierGrid(): TerrainType[][] {
  const grid = Array.from({ length: MAP_SIZE }, () =>
    Array.from({ length: MAP_SIZE }, () => TerrainType.GROUND),
  );
  // Mur vertical bloquant : le couloir en L (rangée 1) ouvrira une brèche.
  for (let y = 0; y < MAP_SIZE; y++) grid[y][5] = TerrainType.WALL;
  return grid;
}

describe('ensureConnectivity', () => {
  it('détecte une grille déconnectée et creuse un couloir', () => {
    const grid = barrierGrid();
    expect(isConnected(grid)).toBe(false);
    ensureConnectivity(grid);
    expect(isConnected(grid)).toBe(true);
  });

  it('ne touche pas une grille déjà connexe', () => {
    const open = Array.from({ length: MAP_SIZE }, () =>
      Array.from({ length: MAP_SIZE }, () => TerrainType.GROUND),
    );
    expect(isConnected(open)).toBe(true);
    ensureConnectivity(open);
    expect(open.every((row) => row.every((c) => c === TerrainType.GROUND))).toBe(true);
  });
});

describe('generateMap', () => {
  it('fonctionne sans randomSeed (seed aléatoire)', () => {
    const map = generateMap('NATURE');
    expect(map.grid).toHaveLength(MAP_SIZE);
    expect(map.seedId).toBe('NATURE');
  });

  it('retourne une grille MAP_SIZE × MAP_SIZE avec le seedId fourni', () => {
    const map = generateMap('FORGE', 42);
    expect(map.width).toBe(MAP_SIZE);
    expect(map.height).toBe(MAP_SIZE);
    expect(map.grid).toHaveLength(MAP_SIZE);
    for (const row of map.grid) expect(row).toHaveLength(MAP_SIZE);
    expect(map.seedId).toBe('FORGE');
  });

  it('est déterministe pour un même (seedId, randomSeed)', () => {
    expect(generateMap('NATURE', 42).grid).toEqual(generateMap('NATURE', 42).grid);
  });

  it('produit des grilles différentes pour des randomSeed différents', () => {
    const a = generateMap('FORGE', 1).grid.flat();
    const b = generateMap('FORGE', 99999).grid.flat();
    expect(a.some((cell, i) => cell !== b[i])).toBe(true);
  });

  it('entoure la map de WALL', () => {
    const map = generateMap('FORGE', 42);
    for (let i = 0; i < MAP_SIZE; i++) {
      expect(map.grid[i][0]).toBe(TerrainType.WALL);
      expect(map.grid[i][MAP_SIZE - 1]).toBe(TerrainType.WALL);
      expect(map.grid[0][i]).toBe(TerrainType.WALL);
      expect(map.grid[MAP_SIZE - 1][i]).toBe(TerrainType.WALL);
    }
  });

  it('garde les coins de spawn 2×2 en GROUND', () => {
    const map = generateMap('FORGE', 42);
    for (let x = 1; x < 3; x++) {
      for (let y = 1; y < 3; y++) {
        expect(map.grid[y][x]).toBe(TerrainType.GROUND);
        expect(map.grid[MAP_SIZE - 1 - y][MAP_SIZE - 1 - x]).toBe(TerrainType.GROUND);
      }
    }
  });

  it('ne place que les terrains de SEED_CONFIGS[seedId] (+ GROUND + WALL)', () => {
    const map = generateMap('FORGE', 1);
    const allowed = new Set([
      TerrainType.GROUND,
      TerrainType.WALL,
      TerrainType.IRON,
      TerrainType.LEATHER,
      TerrainType.HERB,
      TerrainType.GOLD,
    ]);
    for (const cell of map.grid.flat()) expect(allowed.has(cell)).toBe(true);
  });

  it('garantit un chemin entre les deux coins de spawn pour chaque seed', () => {
    for (const seedId of ALL_SEED_IDS) {
      expect(isPathBetweenSpawns(generateMap(seedId, 12345).grid)).toBe(true);
    }
  });
});

function isPathBetweenSpawns(grid: TerrainType[][]): boolean {
  const goal = `${MAP_SIZE - 2},${MAP_SIZE - 2}`;
  const visited = new Set(['1,1']);
  const queue: [number, number][] = [[1, 1]];
  while (queue.length > 0) {
    const [x, y] = queue.shift() as [number, number];
    if (`${x},${y}` === goal) return true;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 1 || nx >= MAP_SIZE - 1 || ny < 1 || ny >= MAP_SIZE - 1) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key) || !TERRAIN_PROPERTIES[grid[ny][nx]].traversable) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}

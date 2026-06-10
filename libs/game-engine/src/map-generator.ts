import type { GameMap, SeedId } from '@game/shared-types';
import { MAP_SIZE, SEED_CONFIGS, TERRAIN_PROPERTIES, TerrainType } from '@game/shared-types';

interface Budget {
  type: TerrainType;
  count: number;
  clustered: boolean;
}

const RESOURCE_BUDGETS: Record<TerrainType, { count: number; clustered: boolean }> = {
  [TerrainType.GROUND]: { count: 0, clustered: false },
  [TerrainType.IRON]: { count: 3, clustered: true },
  [TerrainType.LEATHER]: { count: 2, clustered: false },
  [TerrainType.CRYSTAL]: { count: 2, clustered: true },
  [TerrainType.FABRIC]: { count: 2, clustered: false },
  [TerrainType.WOOD]: { count: 3, clustered: true },
  [TerrainType.HERB]: { count: 3, clustered: false },
  [TerrainType.GOLD]: { count: 2, clustered: true },
  [TerrainType.WALL]: { count: 0, clustered: false },
};

type Rng = () => number;

interface GenContext {
  grid: TerrainType[][];
  spawn: Set<string>;
  rand: Rng;
}

// Linear congruential generator — same constants as the historical backend generator,
// so a given (seedId, randomSeed) yields a byte-identical grid on client and server.
function makeRng(randomSeed?: number): Rng {
  let seed = randomSeed ?? Math.floor(Math.random() * 1_000_000);
  return (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function baseGrid(): TerrainType[][] {
  const grid = Array.from({ length: MAP_SIZE }, () =>
    Array.from({ length: MAP_SIZE }, () => TerrainType.GROUND),
  );
  for (let i = 0; i < MAP_SIZE; i++) {
    grid[i][0] = TerrainType.WALL;
    grid[i][MAP_SIZE - 1] = TerrainType.WALL;
    grid[0][i] = TerrainType.WALL;
    grid[MAP_SIZE - 1][i] = TerrainType.WALL;
  }
  return grid;
}

function spawnZones(): Set<string> {
  const zones = new Set<string>();
  for (let x = 0; x < 2; x++) {
    for (let y = 0; y < 2; y++) {
      zones.add(`${1 + x},${1 + y}`);
      zones.add(`${MAP_SIZE - 2 - x},${MAP_SIZE - 2 - y}`);
    }
  }
  return zones;
}

function isFree(ctx: GenContext, x: number, y: number): boolean {
  if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return false;
  return ctx.grid[y][x] === TerrainType.GROUND && !ctx.spawn.has(`${x},${y}`);
}

function shuffle<T>(arr: T[], rand: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function growCluster(
  ctx: GenContext,
  type: TerrainType,
  origin: [number, number],
  room: number,
): number {
  const [sx, sy] = origin;
  const neighbors = shuffle(
    [
      [sx - 1, sy],
      [sx + 1, sy],
      [sx, sy - 1],
      [sx, sy + 1],
      [sx - 1, sy - 1],
      [sx + 1, sy + 1],
    ],
    ctx.rand,
  );
  let added = 0;
  for (const [nx, ny] of neighbors) {
    if (added >= room) break;
    if (isFree(ctx, nx, ny)) {
      ctx.grid[ny][nx] = type;
      added++;
    }
  }
  return added;
}

function placeCluster(ctx: GenContext, type: TerrainType, count: number): void {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < 500) {
    attempts++;
    const sx = Math.floor(ctx.rand() * MAP_SIZE);
    const sy = Math.floor(ctx.rand() * MAP_SIZE);
    if (!isFree(ctx, sx, sy)) continue;
    ctx.grid[sy][sx] = type;
    placed++;
    placed += growCluster(ctx, type, [sx, sy], count - placed);
  }
}

function placeScattered(ctx: GenContext, type: TerrainType, count: number): void {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < 500) {
    attempts++;
    const x = Math.floor(ctx.rand() * MAP_SIZE);
    const y = Math.floor(ctx.rand() * MAP_SIZE);
    if (isFree(ctx, x, y)) {
      ctx.grid[y][x] = type;
      placed++;
    }
  }
}

function placeBudget(ctx: GenContext, budget: Budget): void {
  if (budget.count === 0) return;
  if (budget.clustered) placeCluster(ctx, budget.type, budget.count);
  else placeScattered(ctx, budget.type, budget.count);
}

function budgetsFor(seedId: SeedId): Budget[] {
  return SEED_CONFIGS[seedId].resources.map((type) => ({ type, ...RESOURCE_BUDGETS[type] }));
}

function walkable(grid: TerrainType[][], x: number, y: number): boolean {
  if (x < 1 || x >= MAP_SIZE - 1 || y < 1 || y >= MAP_SIZE - 1) return false;
  return TERRAIN_PROPERTIES[grid[y][x]].traversable;
}

function orthNeighbors(x: number, y: number): [number, number][] {
  return [
    [x, y + 1],
    [x, y - 1],
    [x + 1, y],
    [x - 1, y],
  ];
}

/** BFS connectivity between the two interior spawn corners. */
export function isConnected(grid: TerrainType[][]): boolean {
  const goal = `${MAP_SIZE - 2},${MAP_SIZE - 2}`;
  const visited = new Set(['1,1']);
  const queue: [number, number][] = [[1, 1]];
  while (queue.length > 0) {
    const [x, y] = queue.shift() as [number, number];
    if (`${x},${y}` === goal) return true;
    for (const [nx, ny] of orthNeighbors(x, y)) {
      const key = `${nx},${ny}`;
      if (visited.has(key) || !walkable(grid, nx, ny)) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}

/** Ensures the two spawn corners are connected, carving an L-corridor if needed. */
export function ensureConnectivity(grid: TerrainType[][]): void {
  if (!isConnected(grid)) carveCorridor(grid);
}

/** Carve an L-shaped corridor when the spawn corners are not connected. */
function carveCorridor(grid: TerrainType[][]): void {
  let cx = 1;
  let cy = 1;
  while (cx < MAP_SIZE - 2 || cy < MAP_SIZE - 2) {
    if (!TERRAIN_PROPERTIES[grid[cy][cx]].traversable) grid[cy][cx] = TerrainType.GROUND;
    if (cx < MAP_SIZE - 2) cx++;
    else cy++;
    if (cy < MAP_SIZE - 2 && cx === MAP_SIZE - 2) cy++;
  }
}

/**
 * Pure, deterministic map generator. Single source of truth shared by the API
 * (world map service) and the web scene editor's play mode.
 */
export function generateMap(seedId: SeedId, randomSeed?: number): GameMap {
  const ctx: GenContext = { grid: baseGrid(), spawn: spawnZones(), rand: makeRng(randomSeed) };
  for (const budget of budgetsFor(seedId)) placeBudget(ctx, budget);
  ensureConnectivity(ctx.grid);
  return { width: MAP_SIZE, height: MAP_SIZE, grid: ctx.grid, seedId };
}

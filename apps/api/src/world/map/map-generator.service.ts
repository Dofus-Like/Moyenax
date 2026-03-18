import { Injectable } from '@nestjs/common';
import {
  TerrainType,
  GameMap,
  MAP_SIZE,
  SeedId,
  SEED_CONFIGS,
  ALL_SEED_IDS,
  CombatTerrainType,
  TERRAIN_PROPERTIES,
} from '@game/shared-types';
import { RedisService } from '../../shared/redis/redis.service';

const REDIS_MAP_KEY = 'game:reference-map';

interface TerrainBudget {
  type: TerrainType;
  count: number;
  clustered: boolean;
}

const RESOURCE_BUDGETS: Record<TerrainType, { count: number; clustered: boolean }> = {
  [TerrainType.GROUND]: { count: 0, clustered: false },
  [TerrainType.IRON]: { count: 10, clustered: true },
  [TerrainType.LEATHER]: { count: 8, clustered: false },
  [TerrainType.CRYSTAL]: { count: 8, clustered: true },
  [TerrainType.FABRIC]: { count: 8, clustered: false },
  [TerrainType.WOOD]: { count: 12, clustered: true },
  [TerrainType.HERB]: { count: 10, clustered: false },
  [TerrainType.GOLD]: { count: 6, clustered: true },
};

@Injectable()
export class MapGeneratorService {
  constructor(private readonly redis: RedisService) {}

  async getOrCreateMap(): Promise<GameMap> {
    const cached = await this.redis.get(REDIS_MAP_KEY);
    if (cached) {
      return JSON.parse(cached) as GameMap;
    }

    const seedId = this.pickRandomSeed();
    const map = this.generate(seedId);
    await this.redis.set(REDIS_MAP_KEY, JSON.stringify(map));
    return map;
  }

  async resetMap(seedId?: SeedId): Promise<GameMap> {
    await this.redis.del(REDIS_MAP_KEY);
    const id = seedId ?? this.pickRandomSeed();
    const map = this.generate(id);
    await this.redis.set(REDIS_MAP_KEY, JSON.stringify(map));
    return map;
  }

  private pickRandomSeed(): SeedId {
    return ALL_SEED_IDS[Math.floor(Math.random() * ALL_SEED_IDS.length)];
  }

  generate(seedId: SeedId): GameMap {
    const seedConfig = SEED_CONFIGS[seedId];
    const grid: TerrainType[][] = Array.from({ length: MAP_SIZE }, () =>
      Array.from({ length: MAP_SIZE }, () => TerrainType.GROUND),
    );

    const spawnZones = this.getSpawnZones();

    const budgets: TerrainBudget[] = seedConfig.resources.map((type) => ({
      type,
      ...RESOURCE_BUDGETS[type],
    }));

    for (const budget of budgets) {
      if (budget.count === 0) continue;
      if (budget.clustered) {
        this.placeCluster(grid, budget.type, budget.count, spawnZones);
      } else {
        this.placeScattered(grid, budget.type, budget.count, spawnZones);
      }
    }

    this.ensureConnectivity(grid, spawnZones);

    return { width: MAP_SIZE, height: MAP_SIZE, grid, seedId };
  }

  private getSpawnZones(): Set<string> {
    const zones = new Set<string>();
    const margin = 2;
    for (let x = 0; x < margin; x++) {
      for (let y = 0; y < margin; y++) {
        zones.add(`${x},${y}`);
        zones.add(`${MAP_SIZE - 1 - x},${MAP_SIZE - 1 - y}`);
      }
    }
    return zones;
  }

  /**
   * Verifies that the two spawn corners are reachable from each other.
   * If blocked, carves a walkable corridor.
   */
  private ensureConnectivity(grid: TerrainType[][], spawnZones: Set<string>): void {
    const start = { x: 0, y: 0 };
    const end = { x: MAP_SIZE - 1, y: MAP_SIZE - 1 };

    const visited = new Set<string>();
    const queue = [start];
    visited.add(`${start.x},${start.y}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === end.x && current.y === end.y) return;

      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (!TERRAIN_PROPERTIES[grid[ny][nx]].traversable) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }

    let cx = 0, cy = 0;
    while (cx < MAP_SIZE - 1 || cy < MAP_SIZE - 1) {
      if (!TERRAIN_PROPERTIES[grid[cy][cx]].traversable) {
        grid[cy][cx] = TerrainType.GROUND;
      }
      if (cx < MAP_SIZE - 1) cx++;
      else cy++;
      if (cy < MAP_SIZE - 1 && cx === MAP_SIZE - 1) cy++;
    }
  }

  private placeCluster(
    grid: TerrainType[][],
    type: TerrainType,
    count: number,
    spawnZones: Set<string>,
  ): void {
    const clusterSize = Math.ceil(count / 2);
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < 500) {
      const sx = Math.floor(Math.random() * MAP_SIZE);
      const sy = Math.floor(Math.random() * MAP_SIZE);

      if (spawnZones.has(`${sx},${sy}`) || grid[sy][sx] !== TerrainType.GROUND) {
        attempts++;
        continue;
      }

      grid[sy][sx] = type;
      placed++;

      const toExpand = Math.min(clusterSize - 1, count - placed);
      const neighbors = this.shuffleArray([
        [sx - 1, sy],
        [sx + 1, sy],
        [sx, sy - 1],
        [sx, sy + 1],
        [sx - 1, sy - 1],
        [sx + 1, sy + 1],
      ]);

      for (const [nx, ny] of neighbors) {
        if (placed >= count) break;
        if (
          nx >= 0 && nx < MAP_SIZE &&
          ny >= 0 && ny < MAP_SIZE &&
          grid[ny][nx] === TerrainType.GROUND &&
          !spawnZones.has(`${nx},${ny}`)
        ) {
          grid[ny][nx] = type;
          placed++;
        }
      }

      attempts++;
    }
  }

  private placeScattered(
    grid: TerrainType[][],
    type: TerrainType,
    count: number,
    spawnZones: Set<string>,
  ): void {
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < 500) {
      const x = Math.floor(Math.random() * MAP_SIZE);
      const y = Math.floor(Math.random() * MAP_SIZE);

      if (grid[y][x] === TerrainType.GROUND && !spawnZones.has(`${x},${y}`)) {
        grid[y][x] = type;
        placed++;
      }

      attempts++;
    }
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

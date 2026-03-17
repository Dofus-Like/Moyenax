import { Injectable } from '@nestjs/common';
import { TerrainType, GameMap, MAP_SIZE } from '@game/shared-types';
import { RedisService } from '../../shared/redis/redis.service';

const REDIS_MAP_KEY = 'game:reference-map';

interface TerrainBudget {
  type: TerrainType;
  count: number;
  clustered: boolean;
}

@Injectable()
export class MapGeneratorService {
  constructor(private readonly redis: RedisService) {}

  async getOrCreateMap(): Promise<GameMap> {
    const cached = await this.redis.get(REDIS_MAP_KEY);
    if (cached) {
      return JSON.parse(cached) as GameMap;
    }

    const map = this.generate();
    await this.redis.set(REDIS_MAP_KEY, JSON.stringify(map));
    return map;
  }

  async resetMap(): Promise<GameMap> {
    await this.redis.del(REDIS_MAP_KEY);
    return this.getOrCreateMap();
  }

  generate(): GameMap {
    const grid: TerrainType[][] = Array.from({ length: MAP_SIZE }, () =>
      Array.from({ length: MAP_SIZE }, () => TerrainType.GROUND),
    );

    const budgets: TerrainBudget[] = [
      { type: TerrainType.WATER, count: 18, clustered: true },
      { type: TerrainType.IRON_ORE, count: 8, clustered: true },
      { type: TerrainType.GOLD_ORE, count: 4, clustered: true },
      { type: TerrainType.WOOD, count: 12, clustered: true },
      { type: TerrainType.HERB, count: 10, clustered: false },
      { type: TerrainType.CRYSTAL, count: 5, clustered: true },
      { type: TerrainType.LEATHER, count: 8, clustered: false },
    ];

    const spawnZones = this.getSpawnZones();

    for (const budget of budgets) {
      if (budget.clustered) {
        this.placeCluster(grid, budget.type, budget.count, spawnZones);
      } else {
        this.placeScattered(grid, budget.type, budget.count, spawnZones);
      }
    }

    return { width: MAP_SIZE, height: MAP_SIZE, grid };
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
      const seedX = Math.floor(Math.random() * MAP_SIZE);
      const seedY = Math.floor(Math.random() * MAP_SIZE);

      if (spawnZones.has(`${seedX},${seedY}`) || grid[seedY][seedX] !== TerrainType.GROUND) {
        attempts++;
        continue;
      }

      grid[seedY][seedX] = type;
      placed++;

      const toExpand = Math.min(clusterSize - 1, count - placed);
      const neighbors = this.shuffleArray([
        [seedX - 1, seedY],
        [seedX + 1, seedY],
        [seedX, seedY - 1],
        [seedX, seedY + 1],
        [seedX - 1, seedY - 1],
        [seedX + 1, seedY + 1],
      ]);

      for (const [nx, ny] of neighbors) {
        if (placed >= count || placed >= placed + toExpand) break;
        if (
          nx >= 0 &&
          nx < MAP_SIZE &&
          ny >= 0 &&
          ny < MAP_SIZE &&
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

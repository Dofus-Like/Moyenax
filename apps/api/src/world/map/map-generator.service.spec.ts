import { Test, TestingModule } from '@nestjs/testing';
import { MapGeneratorService } from './map-generator.service';
import { RedisService } from '../../shared/redis/redis.service';
import { MAP_SIZE, TERRAIN_PROPERTIES, TerrainType, ALL_SEED_IDS } from '@game/shared-types';

describe('MapGeneratorService', () => {
  let service: MapGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MapGeneratorService, { provide: RedisService, useValue: {} }],
    }).compile();
    service = module.get(MapGeneratorService);
  });

  describe('generate', () => {
    it('retourne une map de taille MAP_SIZE × MAP_SIZE', () => {
      const map = service.generate('FORGE', 42);
      expect(map.width).toBe(MAP_SIZE);
      expect(map.height).toBe(MAP_SIZE);
      expect(map.grid).toHaveLength(MAP_SIZE);
      map.grid.forEach((row) => expect(row).toHaveLength(MAP_SIZE));
    });

    it('attribue le seedId fourni', () => {
      expect(service.generate('FORGE', 1).seedId).toBe('FORGE');
      expect(service.generate('ARCANE', 1).seedId).toBe('ARCANE');
    });

    it('est déterministe avec le même seed', () => {
      const a = service.generate('FORGE', 42);
      const b = service.generate('FORGE', 42);
      expect(a.grid).toEqual(b.grid);
    });

    it('produit des maps différentes avec seeds différents', () => {
      const a = service.generate('FORGE', 1);
      const b = service.generate('FORGE', 99999);
      // Très probable qu'au moins une case diffère
      const diffs = a.grid.flat().filter((cell, i) => cell !== b.grid.flat()[i]);
      expect(diffs.length).toBeGreaterThan(0);
    });

    it('laisse les 4 coins de spawn (2x2 chaque) en GROUND', () => {
      const map = service.generate('FORGE', 42);
      // Coin top-left
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          expect(map.grid[y][x]).toBe(TerrainType.GROUND);
        }
      }
      // Coin bottom-right
      for (let x = MAP_SIZE - 2; x < MAP_SIZE; x++) {
        for (let y = MAP_SIZE - 2; y < MAP_SIZE; y++) {
          expect(map.grid[y][x]).toBe(TerrainType.GROUND);
        }
      }
    });

    it('assure qu\'un chemin existe entre les deux coins de spawn', () => {
      for (const seed of ALL_SEED_IDS) {
        const map = service.generate(seed, 12345);
        const start = { x: 0, y: 0 };
        const end = { x: MAP_SIZE - 1, y: MAP_SIZE - 1 };
        const visited = new Set<string>();
        const queue = [start];
        visited.add('0,0');
        let reached = false;
        while (queue.length > 0) {
          const cur = queue.shift()!;
          if (cur.x === end.x && cur.y === end.y) {
            reached = true;
            break;
          }
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) continue;
            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            if (!TERRAIN_PROPERTIES[map.grid[ny][nx]].traversable) continue;
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
        expect(reached).toBe(true);
      }
    });

    it('ne place que les terrains listés dans SEED_CONFIGS[seedId].resources (+ GROUND)', () => {
      const map = service.generate('FORGE', 1);
      const types = new Set(map.grid.flat());
      // FORGE = IRON, LEATHER, HERB, GOLD + GROUND
      const allowed = new Set([
        TerrainType.GROUND,
        TerrainType.IRON,
        TerrainType.LEATHER,
        TerrainType.HERB,
        TerrainType.GOLD,
      ]);
      types.forEach((t) => expect(allowed).toContain(t));
    });
  });

  describe('getOrCreateMap', () => {
    it('génère avec un seedId aléatoire si non fourni', async () => {
      const map = await service.getOrCreateMap();
      expect(ALL_SEED_IDS).toContain(map.seedId);
    });

    it('utilise le seedId fourni', async () => {
      const map = await service.getOrCreateMap('NATURE', 42);
      expect(map.seedId).toBe('NATURE');
    });
  });

  describe('resetMap', () => {
    it('retourne une nouvelle map avec le seed spécifié', async () => {
      const map = await service.resetMap('ARCANE', 99);
      expect(map.seedId).toBe('ARCANE');
    });

    it('retourne une map avec seed aléatoire si non fourni', async () => {
      const map = await service.resetMap();
      expect(ALL_SEED_IDS).toContain(map.seedId);
    });
  });
});

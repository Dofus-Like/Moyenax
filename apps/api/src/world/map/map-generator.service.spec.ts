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

    it('laisse les coins de spawn (2x2) en GROUND, 1 case à l\'intérieur du bord', () => {
      const map = service.generate('FORGE', 42);
      // Top-left spawn inside border: (1,1)-(2,2)
      for (let x = 1; x < 3; x++) {
        for (let y = 1; y < 3; y++) {
          expect(map.grid[y][x]).toBe(TerrainType.GROUND);
        }
      }
      // Bottom-right spawn inside border: (MAP_SIZE-3,MAP_SIZE-3)-(MAP_SIZE-2,MAP_SIZE-2)
      for (let x = MAP_SIZE - 3; x < MAP_SIZE - 1; x++) {
        for (let y = MAP_SIZE - 3; y < MAP_SIZE - 1; y++) {
          expect(map.grid[y][x]).toBe(TerrainType.GROUND);
        }
      }
    });

    it('place des WALL sur tout le contour de la map', () => {
      const map = service.generate('FORGE', 42);
      for (let y = 0; y < MAP_SIZE; y++) {
        expect(map.grid[y][0]).toBe(TerrainType.WALL);
        expect(map.grid[y][MAP_SIZE - 1]).toBe(TerrainType.WALL);
      }
      for (let x = 0; x < MAP_SIZE; x++) {
        expect(map.grid[0][x]).toBe(TerrainType.WALL);
        expect(map.grid[MAP_SIZE - 1][x]).toBe(TerrainType.WALL);
      }
    });

    it('assure qu\'un chemin existe entre les deux coins de spawn (intérieur)', () => {
      for (const seed of ALL_SEED_IDS) {
        const map = service.generate(seed, 12345);
        const start = { x: 1, y: 1 };
        const end = { x: MAP_SIZE - 2, y: MAP_SIZE - 2 };
        const visited = new Set<string>();
        const queue = [start];
        visited.add('1,1');
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
            if (nx < 1 || nx >= MAP_SIZE - 1 || ny < 1 || ny >= MAP_SIZE - 1) continue;
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

    it('ne place que les terrains listés dans SEED_CONFIGS[seedId].resources (+ GROUND + WALL)', () => {
      const map = service.generate('FORGE', 1);
      const types = new Set(map.grid.flat());
      // FORGE = IRON, LEATHER, HERB, GOLD + GROUND + WALL (border)
      const allowed = new Set([
        TerrainType.GROUND,
        TerrainType.IRON,
        TerrainType.LEATHER,
        TerrainType.HERB,
        TerrainType.GOLD,
        TerrainType.WALL,
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

import { MapService } from './map.service';
import { MAP_SIZE, TerrainType } from '@game/shared-types';

describe('MapService', () => {
  let service: MapService;

  beforeEach(() => {
    service = new MapService();
  });

  describe('generateCombatMap', () => {
    it('retourne width×height tiles', () => {
      const tiles = service.generateCombatMap(5, 5);
      expect(tiles).toHaveLength(25);
    });

    it('taille par défaut 10×10', () => {
      const tiles = service.generateCombatMap();
      expect(tiles).toHaveLength(100);
    });

    it('laisse les coins de spawn en GROUND (top-left et bottom-right 3x3)', () => {
      const tiles = service.generateCombatMap(10, 10);
      const findTile = (x: number, y: number) => tiles.find((t) => t.x === x && t.y === y);
      // top-left 3x3
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          expect(findTile(x, y)?.type).toBe(TerrainType.GROUND);
        }
      }
      // bottom-right 3x3
      for (let x = 7; x < 10; x++) {
        for (let y = 7; y < 10; y++) {
          expect(findTile(x, y)?.type).toBe(TerrainType.GROUND);
        }
      }
    });

    it('tous les tiles ont un type valide', () => {
      const tiles = service.generateCombatMap(10, 10);
      const valid = Object.values(TerrainType);
      tiles.forEach((t) => expect(valid).toContain(t.type));
    });
  });

  describe('getReachablePositions', () => {
    const emptyTiles = () => {
      const tiles: Array<{ x: number; y: number; type: TerrainType }> = [];
      for (let x = -5; x <= 5; x++) {
        for (let y = -5; y <= 5; y++) {
          tiles.push({ x, y, type: TerrainType.GROUND });
        }
      }
      return tiles;
    };

    it('retourne les cases à portée de PM', () => {
      const positions = service.getReachablePositions({ x: 0, y: 0 }, 2, emptyTiles(), []);
      // With PM=2, reachable = positions distantes de ≤2 (manhattan), hors soi-même
      expect(positions.length).toBeGreaterThan(0);
      positions.forEach((p) => {
        expect(Math.abs(p.x) + Math.abs(p.y)).toBeLessThanOrEqual(2);
        expect(Math.abs(p.x) + Math.abs(p.y)).toBeGreaterThan(0);
      });
    });

    it('exclut la case de départ', () => {
      const positions = service.getReachablePositions({ x: 0, y: 0 }, 3, emptyTiles(), []);
      expect(positions.find((p) => p.x === 0 && p.y === 0)).toBeUndefined();
    });

    it('exclut les cases occupées', () => {
      const occupied = [{ x: 1, y: 0 }];
      const positions = service.getReachablePositions({ x: 0, y: 0 }, 3, emptyTiles(), occupied);
      expect(positions.find((p) => p.x === 1 && p.y === 0)).toBeUndefined();
    });

    it('retourne liste vide si PM = 0', () => {
      const positions = service.getReachablePositions({ x: 0, y: 0 }, 0, emptyTiles(), []);
      expect(positions).toEqual([]);
    });
  });
});

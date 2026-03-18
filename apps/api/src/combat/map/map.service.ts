import { Injectable } from '@nestjs/common';
import { CombatPosition, TerrainType, Tile } from '@game/shared-types';
import { canMoveTo } from '@game/game-engine';

@Injectable()
export class MapService {
  /**
   * Génère une carte de combat (snapshot simplifié pour l'instant).
   * 20x20 par défaut comme dans le GDD.
   */
  generateCombatMap(width = 20, height = 20): Tile[] {
    const tiles: Tile[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let type = TerrainType.GROUND;

        // Éviter les zones de spawn (coins opposés)
        const isSpawnZone = (x <= 2 && y <= 2) || (x >= width - 3 && y >= height - 3);

        if (!isSpawnZone) {
          const rand = Math.random();
          if (rand < 0.1) {
            type = TerrainType.WATER;
          } else if (rand < 0.15) {
            type = TerrainType.IRON_ORE;
          } else if (rand < 0.2) {
            type = TerrainType.HERB;
          }
        }

        tiles.push({ x, y, type });
      }
    }

    return tiles;
  }

  /**
   * Retourne les positions atteignables pour pré-visualisation front.
   */
  getReachablePositions(
    currentPosition: CombatPosition,
    remainingPm: number,
    tiles: Tile[],
    occupiedPositions: CombatPosition[]
  ): CombatPosition[] {
    const reachable: CombatPosition[] = [];

    // On parcourt une zone large autour du joueur
    for (let x = currentPosition.x - remainingPm; x <= currentPosition.x + remainingPm; x++) {
      for (let y = currentPosition.y - remainingPm; y <= currentPosition.y + remainingPm; y++) {
        const target = { x, y };
        if (canMoveTo(target, remainingPm, currentPosition, tiles, occupiedPositions)) {
          reachable.push(target);
        }
      }
    }

    return reachable;
  }
}

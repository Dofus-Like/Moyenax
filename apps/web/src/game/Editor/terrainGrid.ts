import { generateMap } from '@game/game-engine';
import type { GameMap, SceneTerrain } from '@game/shared-types';

/** Seed numérique stable depuis l'id de seed → ressources identiques à chaque rendu. */
export function seedHash(seedId: string): number {
  let hash = 0;
  for (let i = 0; i < seedId.length; i++) hash = (hash * 31 + seedId.charCodeAt(i)) % 1_000_000;
  return hash;
}

/** GameMap effective : grille peinte si présente, sinon génération procédurale. */
export function terrainToMap(terrain: SceneTerrain): GameMap {
  if (terrain.grid) {
    return {
      width: terrain.width,
      height: terrain.height,
      grid: terrain.grid,
      seedId: terrain.seedId,
    };
  }
  return generateMap(terrain.seedId, seedHash(terrain.seedId));
}

// InstancedTerrain centre la grille à l'origine : monde x = cellX - width/2 + 0.5.
export function worldToCell(
  wx: number,
  wz: number,
  width: number,
  height: number,
): [number, number] | null {
  const x = Math.round(wx + width / 2 - 0.5);
  const y = Math.round(wz + height / 2 - 0.5);
  if (x < 0 || x >= width || y < 0 || y >= height) return null;
  return [x, y];
}

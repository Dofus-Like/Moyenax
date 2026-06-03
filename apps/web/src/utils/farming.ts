import { SEED_CONFIGS, TERRAIN_PROPERTIES, type SeedId, type TerrainType } from '@game/shared-types';

export function countRemainingResources(
  grid: TerrainType[][],
  seedId: SeedId,
): Array<{ name: string; count: number }> {
  const config = SEED_CONFIGS[seedId];
  if (!config) return [];

  return config.resources
    .map((t) => {
      const name = TERRAIN_PROPERTIES[t].resourceName;
      if (!name || name === 'Or') return null;

      const remaining = grid.flat().filter((cell) => cell === t).length;
      return { name, count: remaining };
    })
    .filter((r): r is { name: string; count: number } => r !== null);
}

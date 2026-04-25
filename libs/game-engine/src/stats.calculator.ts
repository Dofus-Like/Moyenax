import type { PlayerStats, ItemDefinition } from '@game/shared-types';

export function calculateEffectiveStats(
  baseStats: PlayerStats,
  equippedItems: ItemDefinition[],
): PlayerStats {
  const effectiveStats = { ...baseStats };

  for (const item of equippedItems) {
    if (item.statsBonus) {
      for (const [key, value] of Object.entries(item.statsBonus)) {
        if (value !== undefined && key in effectiveStats) {
          (effectiveStats as Record<string, number>)[key] += value;
        }
      }
    }
  }

  return effectiveStats;
}

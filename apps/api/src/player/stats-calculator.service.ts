import { performance } from 'node:perf_hooks';

import type { PlayerStats } from '@game/shared-types';
import { Injectable } from '@nestjs/common';

import { PerfLoggerService } from '../shared/perf/perf-logger.service';
import { PrismaService } from '../shared/prisma/prisma.service';

type EquippedSlotWithItem = any;
type PlayerStatsModel = {
  baseVit: number;
  baseAtk: number;
  baseMag: number;
  baseDef: number;
  baseRes: number;
  baseIni: number;
  basePa: number;
  basePm: number;
};

@Injectable()
export class StatsCalculatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perfLogger: PerfLoggerService,
  ) {}

  async computeEffectiveStats(playerId: string): Promise<PlayerStats> {
    const startedAt = performance.now();
    const [baseStats, slots] = await Promise.all([
      this.prisma.playerStats.findUnique({
        where: { playerId },
      }),
      this.prisma.equipmentSlot.findMany({
        where: { playerId },
        include: {
          inventoryItem: {
            include: {
              item: true,
            },
          },
          sessionItem: {
            include: {
              item: true,
            },
          },
        },
      }),
    ]);

    if (!baseStats) {
      throw new Error('Stats de base non trouvées');
    }

    const effectiveStats = this.computeEffectiveStatsFromSnapshot(
      baseStats,
      slots as EquippedSlotWithItem[],
    );

    this.perfLogger.logDuration('player', 'stats.compute', performance.now() - startedAt, {
      player_id: playerId,
      equipment_slot_count: slots.length,
    });

    return effectiveStats;
  }

  computeEffectiveStatsFromSnapshot(
    baseStats: PlayerStatsModel,
    slots: EquippedSlotWithItem[],
  ): PlayerStats {
    const effectiveStats: PlayerStats = {
      vit: baseStats.baseVit,
      atk: baseStats.baseAtk,
      mag: baseStats.baseMag,
      def: baseStats.baseDef,
      res: baseStats.baseRes,
      ini: baseStats.baseIni,
      pa: baseStats.basePa,
      pm: baseStats.basePm,
      baseVit: baseStats.baseVit,
      baseAtk: baseStats.baseAtk,
      baseMag: baseStats.baseMag,
      baseDef: baseStats.baseDef,
      baseRes: baseStats.baseRes,
      baseIni: baseStats.baseIni,
      basePa: baseStats.basePa,
      basePm: baseStats.basePm,
    };

    for (const slot of slots) {
      const inventoryItem = slot.inventoryItem;
      const sessionItem = slot.sessionItem;
      const item = inventoryItem?.item ?? sessionItem?.item;
      const rank = inventoryItem?.rank ?? 1; // SessionItems n'ont pas de rang pour l'instant

      if (item?.statsBonus) {
        const bonus = item.statsBonus as Partial<PlayerStats>;
        for (const [key, value] of Object.entries(bonus)) {
          if (key in effectiveStats && typeof value === 'number') {
            (effectiveStats as unknown as Record<string, number>)[key] += value * rank;
          }
        }
      }
    }

    return effectiveStats;
  }
}

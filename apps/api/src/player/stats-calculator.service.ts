import { Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../shared/prisma/prisma.service';
import type { PlayerStats } from '@game/shared-types';
import { PerfLoggerService } from '../shared/perf/perf-logger.service';

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
        },
      }),
    ]);

    if (!baseStats) {
      throw new Error('Stats de base non trouvées');
    }

    // 3. Sommer les bonus en partant des stats de base
    const effectiveStats: PlayerStats = {
      vit: baseStats.baseVit,
      atk: baseStats.baseAtk,
      mag: baseStats.baseMag,
      def: baseStats.baseDef,
      res: baseStats.baseRes,
      ini: baseStats.baseIni,
      pa: baseStats.basePa,
      pm: baseStats.basePm,
      // On recopie aussi les bases pour que l'objet soit complet selon l'interface
      baseVit: baseStats.baseVit,
      baseAtk: baseStats.baseAtk,
      baseMag: baseStats.baseMag,
      baseDef: baseStats.baseDef,
      baseRes: baseStats.baseRes,
      baseIni: baseStats.baseIni,
      basePa: baseStats.basePa,
      basePm: baseStats.basePm,
    };


    slots.forEach((slot) => {
      if (slot.inventoryItem?.item.statsBonus) {
        const bonus = slot.inventoryItem.item.statsBonus as Partial<PlayerStats>;
        Object.entries(bonus).forEach(([key, value]) => {
          if (key in effectiveStats && typeof value === 'number') {
            (effectiveStats as any)[key] += value;
          }
        });
      }
    });

    this.perfLogger.logDuration('player', 'stats.compute', performance.now() - startedAt, {
      player_id: playerId,
      equipment_slot_count: slots.length,
    });

    return effectiveStats;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { PlayerStats } from '@game/shared-types';

@Injectable()
export class StatsCalculatorService {
  constructor(private prisma: PrismaService) {}

  async computeEffectiveStats(playerId: string): Promise<PlayerStats> {
    // 1. Récupérer les stats de base
    const baseStats = await this.prisma.playerStats.findUnique({
      where: { playerId },
    });

    if (!baseStats) {
      throw new Error('Stats de base non trouvées');
    }

    // 2. Récupérer l'équipement
    const slots = await this.prisma.equipmentSlot.findMany({
      where: { playerId },
      include: {
        inventoryItem: {
          include: {
            item: true,
          },
        },
      },
    });

    // 3. Sommer les bonus
    const effectiveStats: PlayerStats = {
      vit: baseStats.vit,
      atk: baseStats.atk,
      mag: baseStats.mag,
      def: baseStats.def,
      res: baseStats.res,
      ini: baseStats.ini,
      pa: baseStats.pa,
      pm: baseStats.pm,
    };

    slots.forEach((slot: any) => {
      if (slot.inventoryItem?.item.statsBonus) {
        const bonus = slot.inventoryItem.item.statsBonus as Partial<PlayerStats>;
        Object.entries(bonus).forEach(([key, value]) => {
          if (key in effectiveStats && typeof value === 'number') {
            (effectiveStats as any)[key] += value;
          }
        });
      }
    });

    return effectiveStats;
  }
}

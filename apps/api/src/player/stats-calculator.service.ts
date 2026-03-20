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

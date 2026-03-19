import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { PlayerStats, ItemType } from '@game/shared-types';
import { StatsCalculatorService } from './stats-calculator.service';

@Injectable()
export class PlayerStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsCalculator: StatsCalculatorService
  ) {}

  async getEffectiveStats(playerId: string): Promise<PlayerStats> {
    return this.statsCalculator.computeEffectiveStats(playerId);
  }

  async getEquippedItems(playerId: string) {
    const slots = await this.prisma.equipmentSlot.findMany({
      where: { 
        playerId,
        NOT: { inventoryItemId: null } 
      },
      include: {
        inventoryItem: {
          include: {
            item: true
          }
        }
      }
    });

    return slots.map(s => ({
      id: s.inventoryItem!.item.id,
      name: s.inventoryItem!.item.name,
      description: s.inventoryItem!.item.description,
      type: s.inventoryItem!.item.type as ItemType,

      family: s.inventoryItem!.item.family,
      statsBonus: s.inventoryItem!.item.statsBonus as Partial<PlayerStats> | null,
      grantsSpells: s.inventoryItem!.item.grantsSpells as string[] | null,
      craftCost: s.inventoryItem!.item.craftCost as Record<string, number> | null,
      shopPrice: s.inventoryItem!.item.shopPrice,
      rank: s.inventoryItem!.item.rank
    }));

  }
}

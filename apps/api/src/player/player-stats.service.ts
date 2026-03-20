import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/prisma/prisma.service';
import type { PlayerStats } from '@game/shared-types';
import { ItemType } from '@game/shared-types';
import { StatsCalculatorService } from './stats-calculator.service';

type EquippedSlotWithItem = Prisma.EquipmentSlotGetPayload<{
  include: {
    inventoryItem: {
      include: {
        item: true;
      };
    };
  };
}>;

@Injectable()
export class PlayerStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsCalculator: StatsCalculatorService,
  ) {}

  async getEffectiveStats(playerId: string): Promise<PlayerStats> {
    const loadout = await this.getCombatLoadout(playerId);
    return loadout.stats;
  }

  async getEquippedItems(playerId: string) {
    const slots = await this.prisma.equipmentSlot.findMany({
      where: {
        playerId,
        NOT: { inventoryItemId: null },
      },
      include: {
        inventoryItem: {
          include: {
            item: true,
          },
        },
      },
    });

    return this.mapEquippedItems(slots as EquippedSlotWithItem[]);
  }

  async getCombatLoadout(playerId: string): Promise<{
    items: ReturnType<PlayerStatsService['mapEquippedItems']>;
    stats: PlayerStats;
  }> {
    const [baseStats, slots] = await Promise.all([
      this.prisma.playerStats.findUnique({
        where: { playerId },
      }),
      this.prisma.equipmentSlot.findMany({
        where: {
          playerId,
          NOT: { inventoryItemId: null },
        },
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

    const typedSlots = slots as EquippedSlotWithItem[];
    return {
      items: this.mapEquippedItems(typedSlots),
      stats: this.statsCalculator.computeEffectiveStatsFromSnapshot(
        baseStats,
        typedSlots,
      ),
    };
  }

  private mapEquippedItems(slots: EquippedSlotWithItem[]) {
    return slots.map((slot) => ({
      id: slot.inventoryItem!.item.id,
      name: slot.inventoryItem!.item.name,
      description: slot.inventoryItem!.item.description,
      type: slot.inventoryItem!.item.type as ItemType,
      family: slot.inventoryItem!.item.family,
      statsBonus:
        slot.inventoryItem!.item.statsBonus as Partial<PlayerStats> | null,
      grantsSpells: slot.inventoryItem!.item.grantsSpells as string[] | null,
      craftCost:
        slot.inventoryItem!.item.craftCost as Record<string, number> | null,
      shopPrice: slot.inventoryItem!.item.shopPrice,
      rank: slot.inventoryItem!.item.rank,
    }));
  }
}

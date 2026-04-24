import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import type { PlayerStats } from '@game/shared-types';
import { ItemType } from '@game/shared-types';
import { StatsCalculatorService } from './stats-calculator.service';

type EquippedSlotWithItem = any;

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
        OR: [{ inventoryItemId: { not: null } }, { sessionItemId: { not: null } }],
      },
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
          OR: [{ inventoryItemId: { not: null } }, { sessionItemId: { not: null } }],
        },
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

    const typedSlots = slots as EquippedSlotWithItem[];
    return {
      items: this.mapEquippedItems(typedSlots),
      stats: this.statsCalculator.computeEffectiveStatsFromSnapshot(baseStats, typedSlots),
    };
  }

  private mapEquippedItems(slots: EquippedSlotWithItem[]) {
    return slots
      .map((slot) => {
        const item = slot.inventoryItem?.item ?? slot.sessionItem?.item;
        if (!item) return null;
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          type: item.type as ItemType,
          family: item.family,
          statsBonus: item.statsBonus as Partial<PlayerStats> | null,
          grantsSpells: item.grantsSpells as string[] | null,
          craftCost: item.craftCost as Record<string, number> | null,
          shopPrice: item.shopPrice,
          rank: item.rank,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }
}

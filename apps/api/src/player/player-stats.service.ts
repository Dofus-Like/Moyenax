import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { PlayerStats, ItemDefinition } from '@game/shared-types';
import { calculateEffectiveStats } from '@game/game-engine';

@Injectable()
export class PlayerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveStats(playerId: string): Promise<PlayerStats> {
    const playerStats = await this.prisma.playerStats.findUnique({
      where: { playerId },
    });

    if (!playerStats) {
      throw new NotFoundException('Stats du joueur introuvables');
    }

    const equippedItems = await this.prisma.inventoryItem.findMany({
      where: { playerId, equipped: true },
      include: { item: true },
    });

    const baseStats: PlayerStats = {
      hp: playerStats.baseHp,
      maxHp: playerStats.baseHp,
      ap: playerStats.baseAp,
      maxAp: playerStats.baseAp,
      mp: playerStats.baseMp,
      maxMp: playerStats.baseMp,
      strength: playerStats.strength,
      agility: playerStats.agility,
      initiative: playerStats.initiative,
    };

    const itemDefinitions: ItemDefinition[] = equippedItems.map(
      (inv: (typeof equippedItems)[number]) => ({
        id: inv.item.id,
        name: inv.item.name,
        type: inv.item.type as ItemDefinition['type'],
        statsBonus: inv.item.statsBonus as Partial<PlayerStats> | null,
        craftCost: inv.item.craftCost as Record<string, number> | null,
        shopPrice: inv.item.shopPrice,
      }),
    );

    return calculateEffectiveStats(baseStats, itemDefinitions);
  }
}

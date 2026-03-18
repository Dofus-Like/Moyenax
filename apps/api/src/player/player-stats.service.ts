import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { PlayerStats, ItemDefinition, ItemType } from '@game/shared-types';
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
      vit: playerStats.vit,
      atk: playerStats.atk,
      mag: playerStats.mag,
      def: playerStats.def,
      res: playerStats.res,
      ini: playerStats.ini,
      pa: playerStats.pa,
      pm: playerStats.pm,
    };

    const itemDefinitions: ItemDefinition[] = equippedItems.map((inv) => ({
      id: inv.item.id,
      name: inv.item.name,
      type: inv.item.type as ItemType,
      statsBonus: inv.item.statsBonus as Partial<PlayerStats> | null,
      craftCost: inv.item.craftCost as Record<string, number> | null,
      shopPrice: inv.item.shopPrice,
      rank: inv.item.rank,
    }));

    return calculateEffectiveStats(baseStats, itemDefinitions);
  }

  async getEquippedItems(playerId: string): Promise<ItemDefinition[]> {
    const equippedItems = await this.prisma.inventoryItem.findMany({
      where: { playerId, equipped: true },
      include: { item: true },
    });

    return equippedItems.map((inv) => ({
      id: inv.item.id,
      name: inv.item.name,
      type: inv.item.type as ItemType,
      statsBonus: inv.item.statsBonus as Partial<PlayerStats> | null,
      craftCost: inv.item.craftCost as Record<string, number> | null,
      shopPrice: inv.item.shopPrice,
      rank: inv.item.rank,
    }));
  }
}

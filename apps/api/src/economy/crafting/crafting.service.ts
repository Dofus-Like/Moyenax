import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

import { GameSessionService } from '../../game-session/game-session.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SpendableGoldService } from '../shared/spendable-gold.service';

interface CraftCostEntry {
  itemId: string;
  quantity: number;
  usesSpendableGold: boolean;
}

@Injectable()
export class CraftingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameSession: GameSessionService,
    private readonly spendableGold: SpendableGoldService,
  ) {}

  async getRecipes() {
    const items = await this.prisma.item.findMany();
    return items.filter((item) => item.craftCost != null);
  }

  async craft(playerId: string, itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });

    if (!item || !item.craftCost) {
      throw new NotFoundException('Recette introuvable');
    }

    const craftCost = item.craftCost as Record<string, number>;
    const costEntries = await this.resolveCraftCostEntries(craftCost);

    const session = await this.gameSession.getActiveSession(playerId);
    if (session) {
      return this.craftSession(playerId, session.id, itemId, costEntries, session);
    }

    return this.prisma.$transaction(async (tx: any) => {
      const goldCost = costEntries
        .filter((entry) => entry.usesSpendableGold)
        .reduce((sum, entry) => sum + entry.quantity, 0);

      await this.spendableGold.debitOrThrowInTransaction(
        tx,
        playerId,
        goldCost,
        null,
        'Or insuffisant pour le craft',
      );

      for (const entry of costEntries.filter((candidate) => !candidate.usesSpendableGold)) {
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { playerId, itemId: entry.itemId, rank: 1 },
        });

        if (!inventoryItem || inventoryItem.quantity < entry.quantity) {
          throw new BadRequestException(`Ressource insuffisante pour le craft`);
        }
      }

      for (const entry of costEntries.filter((candidate) => !candidate.usesSpendableGold)) {
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { playerId, itemId: entry.itemId, rank: 1 },
        });

        if (inventoryItem && inventoryItem.quantity === entry.quantity) {
          await tx.inventoryItem.delete({ where: { id: inventoryItem.id } });
        } else if (inventoryItem) {
          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { quantity: { decrement: entry.quantity } },
          });
        }
      }

      const existing = await tx.inventoryItem.findUnique({
        where: { playerId_itemId_rank: { playerId, itemId, rank: 1 } },
      });

      if (existing) {
        return tx.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: 1 } },
          include: { item: true },
        });
      }

      return tx.inventoryItem.create({
        data: { playerId, itemId, quantity: 1, rank: 1 },
        include: { item: true },
      });
    });
  }

  private async craftSession(
    playerId: string,
    sessionId: string,
    itemId: string,
    costEntries: CraftCostEntry[],
    session: Awaited<ReturnType<GameSessionService['getActiveSession']>>,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const goldCost = costEntries
        .filter((entry) => entry.usesSpendableGold)
        .reduce((sum, entry) => sum + entry.quantity, 0);

      await this.spendableGold.debitOrThrowInTransaction(
        tx,
        playerId,
        goldCost,
        session,
        'Pièces insuffisantes pour le craft',
      );

      for (const entry of costEntries.filter((candidate) => !candidate.usesSpendableGold)) {
        const row = await (tx as any).sessionItem.findUnique({
          where: {
            sessionId_playerId_itemId: { sessionId, playerId, itemId: entry.itemId },
          },
        });

        if (!row || row.quantity < entry.quantity) {
          throw new BadRequestException(`Ressource insuffisante pour le craft`);
        }
      }

      for (const entry of costEntries.filter((candidate) => !candidate.usesSpendableGold)) {
        const row = await (tx as any).sessionItem.findUnique({
          where: {
            sessionId_playerId_itemId: { sessionId, playerId, itemId: entry.itemId },
          },
        });

        if (row.quantity === entry.quantity) {
          await (tx as any).sessionItem.delete({ where: { id: row.id } });
        } else {
          await (tx as any).sessionItem.update({
            where: { id: row.id },
            data: { quantity: { decrement: entry.quantity } },
          });
        }
      }

      const existing = await (tx as any).sessionItem.findUnique({
        where: { sessionId_playerId_itemId: { sessionId, playerId, itemId } },
      });

      if (existing) {
        return (tx as any).sessionItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: 1 } },
          include: { item: true },
        });
      }

      return (tx as any).sessionItem.create({
        data: { sessionId, playerId, itemId, quantity: 1 },
        include: { item: true },
      });
    });
  }

  async merge(playerId: string, itemId: string, currentRank: number) {
    const session = await this.gameSession.getActiveSession(playerId);
    if (session) {
      throw new BadRequestException(
        "La fusion d'objets n'est pas disponible pendant une session de jeu pour l'instant",
      );
    }

    if (currentRank >= 3) {
      throw new BadRequestException('Rang maximum déjà atteint');
    }

    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { playerId_itemId_rank: { playerId, itemId, rank: currentRank } },
    });

    if (!inventoryItem || inventoryItem.quantity < 2 || inventoryItem.rank !== currentRank) {
      throw new BadRequestException('Quantité insuffisante pour la fusion');
    }

    const isEquipped = await this.prisma.equipmentSlot.findFirst({
      where: { playerId, inventoryItemId: inventoryItem.id },
    });

    if (isEquipped) {
      throw new BadRequestException('Impossible de fusionner un objet équipé');
    }

    return this.prisma.$transaction(async (tx: any) => {
      if (inventoryItem.quantity === 2) {
        await tx.inventoryItem.delete({ where: { id: inventoryItem.id } });
      } else {
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { quantity: { decrement: 2 } },
        });
      }

      const nextRank = currentRank + 1;

      const existingHighRank = await tx.inventoryItem.findUnique({
        where: { playerId_itemId_rank: { playerId, itemId, rank: nextRank } },
      });

      if (existingHighRank) {
        return tx.inventoryItem.update({
          where: { id: existingHighRank.id },
          data: { quantity: { increment: 1 } },
          include: { item: true },
        });
      }

      return tx.inventoryItem.create({
        data: { playerId, itemId, quantity: 1, rank: nextRank },
        include: { item: true },
      });
    });
  }

  private async resolveCraftCostEntries(craftCost: Record<string, number>) {
    const itemIds = Object.keys(craftCost);
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true },
    });

    return itemIds.map<CraftCostEntry>((itemId) => {
      const resource = items.find((entry) => entry.id === itemId);

      if (!resource) {
        throw new NotFoundException('Recette introuvable');
      }

      return {
        itemId,
        quantity: craftCost[itemId],
        usesSpendableGold: resource.name === 'Or',
      };
    });
  }
}

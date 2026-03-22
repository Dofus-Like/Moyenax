import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GameSessionService } from '../../game-session/game-session.service';

@Injectable()
export class CraftingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameSession: GameSessionService,
  ) {}

  async getRecipes() {
    return this.prisma.item.findMany({
      where: { NOT: { craftCost: null } },
    });
  }

  async craft(playerId: string, itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });

    if (!item || !item.craftCost) {
      throw new NotFoundException('Recette introuvable');
    }

    const craftCost = item.craftCost as Record<string, number>;

    const session = await this.gameSession.getActiveSession(playerId);
    if (session) {
      return this.craftSession(playerId, session.id, itemId, craftCost);
    }

    return this.prisma.$transaction(async (tx: any) => {
      for (const [resourceItemId, requiredQty] of Object.entries(craftCost)) {
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { playerId, itemId: resourceItemId, rank: 1 },
        });

        if (!inventoryItem || inventoryItem.quantity < requiredQty) {
          throw new BadRequestException(`Ressource insuffisante pour le craft`);
        }
      }

      for (const [resourceItemId, requiredQty] of Object.entries(craftCost)) {
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { playerId, itemId: resourceItemId, rank: 1 },
        });

        if (inventoryItem && inventoryItem.quantity === requiredQty) {
          await tx.inventoryItem.delete({ where: { id: inventoryItem.id } });
        } else if (inventoryItem) {
          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { quantity: { decrement: requiredQty } },
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
    craftCost: Record<string, number>,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      for (const [resourceItemId, requiredQty] of Object.entries(craftCost)) {
        const row = await (tx as any).sessionItem.findUnique({
          where: {
            sessionId_playerId_itemId: { sessionId, playerId, itemId: resourceItemId },
          },
        });

        if (!row || row.quantity < requiredQty) {
          throw new BadRequestException(`Ressource insuffisante pour le craft`);
        }
      }

      for (const [resourceItemId, requiredQty] of Object.entries(craftCost)) {
        const row = await (tx as any).sessionItem.findUnique({
          where: {
            sessionId_playerId_itemId: { sessionId, playerId, itemId: resourceItemId },
          },
        });

        if (row.quantity === requiredQty) {
          await (tx as any).sessionItem.delete({ where: { id: row.id } });
        } else {
          await (tx as any).sessionItem.update({
            where: { id: row.id },
            data: { quantity: { decrement: requiredQty } },
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
}

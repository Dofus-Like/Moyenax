import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';



import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class CraftingService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecipes() {
    return this.prisma.item.findMany({
      where: { craftCost: { not: Prisma.DbNull } },
    });
  }

  async craft(playerId: string, itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });

    if (!item || !item.craftCost) {
      throw new NotFoundException('Recette introuvable');
    }

    const craftCost = item.craftCost as Record<string, number>;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Vérifier que le joueur possède toutes les ressources nécessaires
      for (const [resourceItemId, requiredQty] of Object.entries(craftCost)) {
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { playerId, itemId: resourceItemId, rank: 1 },
        });

        if (!inventoryItem || inventoryItem.quantity < requiredQty) {
          throw new BadRequestException(`Ressource insuffisante pour le craft`);
        }
      }

      // Consommer les ressources
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

      // Ajouter l'item crafté à l'inventaire
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

  async merge(playerId: string, itemId: string, currentRank: number) {
    if (currentRank >= 3) {
      throw new BadRequestException('Rang maximum déjà atteint');
    }

    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { playerId_itemId_rank: { playerId, itemId, rank: currentRank } },
    });

    if (!inventoryItem || inventoryItem.quantity < 2 || inventoryItem.rank !== currentRank) {
      throw new BadRequestException('Quantité insuffisante pour la fusion');
    }

    // Vérifier si l'item est équipé
    const isEquipped = await this.prisma.equipmentSlot.findFirst({
      where: { playerId, inventoryItemId: inventoryItem.id }
    });

    if (isEquipped) {
      throw new BadRequestException('Impossible de fusionner un objet équipé');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Consommer les 2 items
      if (inventoryItem.quantity === 2) {
        await tx.inventoryItem.delete({ where: { id: inventoryItem.id } });
      } else {
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { quantity: { decrement: 2 } },
        });
      }

      // Créer/Incrémenter l'item de rang supérieur
      const nextRank = currentRank + 1;
      
      const existingHighRank = await tx.inventoryItem.findUnique({
        where: { playerId_itemId_rank: { playerId, itemId, rank: nextRank } }
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

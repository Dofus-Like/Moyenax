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
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: { playerId_itemId: { playerId, itemId: resourceItemId } },
        });

        if (!inventoryItem || inventoryItem.quantity < requiredQty) {
          throw new BadRequestException(`Ressource insuffisante pour le craft`);
        }
      }

      // Consommer les ressources
      for (const [resourceItemId, requiredQty] of Object.entries(craftCost)) {
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: { playerId_itemId: { playerId, itemId: resourceItemId } },
        });

        if (inventoryItem!.quantity === requiredQty) {
          await tx.inventoryItem.delete({ where: { id: inventoryItem!.id } });
        } else {
          await tx.inventoryItem.update({
            where: { id: inventoryItem!.id },
            data: { quantity: { decrement: requiredQty } },
          });
        }
      }

      // Ajouter l'item crafté à l'inventaire
      const existing = await tx.inventoryItem.findUnique({
        where: { playerId_itemId: { playerId, itemId } },
      });

      if (existing) {
        return tx.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: 1 } },
          include: { item: true },
        });
      }

      return tx.inventoryItem.create({
        data: { playerId, itemId, quantity: 1 },
        include: { item: true },
      });
    });
  }
}

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';



import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableItems() {
    return this.prisma.item.findMany({
      where: { shopPrice: { not: null } },
    });
  }

  async buy(playerId: string, itemId: string, quantity: number) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.shopPrice === null) {
      throw new NotFoundException('Item non disponible en boutique');
    }

    const totalCost = item.shopPrice * quantity;
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player || player.gold < totalCost) {
      throw new BadRequestException('Or insuffisant');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.player.update({
        where: { id: playerId },
        data: { gold: { decrement: totalCost } },
      });

      const existing = await tx.inventoryItem.findUnique({
        where: { playerId_itemId_rank: { playerId, itemId, rank: 1 } },
      });

      if (existing) {
        return tx.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } },
          include: { item: true },
        });
      }

      return tx.inventoryItem.create({
        data: { playerId, itemId, quantity, rank: 1 },
        include: { item: true },
      });
    });
  }

  async sell(playerId: string, inventoryItemId: string, quantity: number) {
    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { item: true },
    });

    if (!inventoryItem || inventoryItem.playerId !== playerId) {
      throw new NotFoundException('Item non trouvé dans l\'inventaire');
    }

    if (inventoryItem.quantity < quantity) {
      throw new BadRequestException('Quantité insuffisante');
    }

    const sellPrice = Math.floor((inventoryItem.item.shopPrice ?? 0) * 0.5) * quantity;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.player.update({
        where: { id: playerId },
        data: { gold: { increment: sellPrice } },
      });


      if (inventoryItem.quantity === quantity) {
        await tx.inventoryItem.delete({ where: { id: inventoryItemId } });
      } else {
        await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { quantity: { decrement: quantity } },
        });
      }

      return { soldQuantity: quantity, goldEarned: sellPrice };
    });
  }
}

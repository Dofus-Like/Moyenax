import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { GameSessionService } from '../../game-session/game-session.service';
import { SpendableGoldService } from '../shared/spendable-gold.service';

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameSession: GameSessionService,
    private readonly spendableGold: SpendableGoldService,
  ) {}

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
    const session = await this.gameSession.getActiveSession(playerId);
    const insufficientMessage = session ? 'Pièces insuffisantes' : 'Or insuffisant';

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.spendableGold.debitOrThrowInTransaction(
        tx,
        playerId,
        totalCost,
        session,
        insufficientMessage,
      );

      if (session) {
        const existing = await (tx as any).sessionItem.findUnique({
          where: { sessionId_playerId_itemId: { sessionId: session.id, playerId, itemId } },
        });

        if (existing) {
          return (tx as any).sessionItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: quantity } },
            include: { item: true },
          });
        }

        return (tx as any).sessionItem.create({
          data: { sessionId: session.id, playerId, itemId, quantity },
          include: { item: true },
        });
      }

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
    const session = await this.gameSession.getActiveSession(playerId);
    let inventoryItem: any;

    if (session) {
      inventoryItem = await this.prisma.sessionItem.findUnique({
        where: { id: inventoryItemId },
        include: { item: true },
      });
    } else {
      inventoryItem = await this.prisma.inventoryItem.findUnique({
        where: { id: inventoryItemId },
        include: { item: true },
      });
    }

    if (!inventoryItem || inventoryItem.playerId !== playerId) {
      throw new NotFoundException('Item non trouvé');
    }

    if (inventoryItem.quantity < quantity) {
      throw new BadRequestException('Quantité insuffisante');
    }

    const sellPrice = Math.floor((inventoryItem.item.shopPrice ?? 0) * 0.5) * quantity;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.spendableGold.creditInTransaction(tx, playerId, sellPrice, session);

      if (inventoryItem.quantity === quantity) {
        if (session) {
          await (tx as any).sessionItem.delete({ where: { id: inventoryItemId } });
        } else {
          await tx.inventoryItem.delete({ where: { id: inventoryItemId } });
        }
      } else if (session) {
        await (tx as any).sessionItem.update({
          where: { id: inventoryItemId },
          data: { quantity: { decrement: quantity } },
        });
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

import { Injectable } from '@nestjs/common';

import { GameSessionService } from '../../game-session/game-session.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameSession: GameSessionService,
  ) {}

  async findAll() {
    return this.prisma.item.findMany({
      where: { type: 'RESOURCE' },
    });
  }

  async gather(resourceId: string, playerId: string) {
    const resource = await this.prisma.item.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new Error('Ressource introuvable');
    }

    const session = await this.gameSession.getActiveSession(playerId);
    if (session) {
      const existingItem = await (this.prisma as any).sessionItem.findUnique({
        where: {
          sessionId_playerId_itemId: { sessionId: session.id, playerId, itemId: resourceId },
        },
      });

      if (existingItem) {
        return (this.prisma as any).sessionItem.update({
          where: { id: existingItem.id },
          data: { quantity: { increment: 1 } },
          include: { item: true },
        });
      }

      return (this.prisma as any).sessionItem.create({
        data: { sessionId: session.id, playerId, itemId: resourceId, quantity: 1 },
        include: { item: true },
      });
    }

    const existingItem = await this.prisma.inventoryItem.findFirst({
      where: { playerId, itemId: resourceId, rank: 1 },
    });

    if (existingItem) {
      return this.prisma.inventoryItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: 1 } },
        include: { item: true },
      });
    }

    return this.prisma.inventoryItem.create({
      data: { playerId, itemId: resourceId, quantity: 1, rank: 1 },
      include: { item: true },
    });
  }
}

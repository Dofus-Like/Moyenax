import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const existingItem = await this.prisma.inventoryItem.findUnique({
      where: { playerId_itemId_rank: { playerId, itemId: resourceId, rank: 1 } },
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findByPlayer(playerId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { playerId },
      include: { item: true },
    });
  }

  async addResourceByName(playerId: string, resourceName: string) {
    const item = await this.prisma.item.findFirst({
      where: { name: resourceName },
    });
    if (!item) throw new NotFoundException(`Ressource introuvable: ${resourceName}`);

    const existingInventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { playerId, itemId: item.id, rank: 1 }
    });

    if (existingInventoryItem) {
      return this.prisma.inventoryItem.update({
        where: { id: existingInventoryItem.id },
        data: { quantity: { increment: 1 } },
      });
    } else {
      return this.prisma.inventoryItem.create({
        data: {
          playerId,
          itemId: item.id,
          quantity: 1,
          rank: 1,
        }
      });
    }
  }
}

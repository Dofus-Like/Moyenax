import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GAME_EVENTS } from '@game/shared-types';

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

  async equip(playerId: string, itemId: string) {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { playerId, itemId },
    });

    if (!inventoryItem) {
      throw new NotFoundException('Item non trouvé dans l\'inventaire');
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { equipped: true },
      include: { item: true },
    });

    this.eventEmitter.emit(GAME_EVENTS.ITEM_EQUIPPED, {
      playerId,
      itemId,
    });

    return updated;
  }

  async unequip(playerId: string, itemId: string) {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { playerId, itemId },
    });

    if (!inventoryItem) {
      throw new NotFoundException('Item non trouvé dans l\'inventaire');
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { equipped: false },
      include: { item: true },
    });

    this.eventEmitter.emit(GAME_EVENTS.ITEM_UNEQUIPPED, {
      playerId,
      itemId,
    });

    return updated;
  }

  async addResourceByName(playerId: string, resourceName: string) {
    const item = await this.prisma.item.findFirst({
      where: { name: resourceName },
    });
    if (!item) throw new NotFoundException(`Ressource introuvable: ${resourceName}`);

    const existingInventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { playerId, itemId: item.id }
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
        }
      });
    }
  }
}


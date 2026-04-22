import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GAME_EVENTS } from '@game/shared-types';
import { GameSessionService } from '../../game-session/game-session.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly gameSession: GameSessionService,
  ) {}

  async findByPlayer(playerId: string) {
    const session = await this.gameSession.getActiveSession(playerId);
    if (session) {
      return (this.prisma as any).sessionItem.findMany({
        where: {
          sessionId: session.id,
          playerId,
          equipmentSlot: { is: null },
        },
        include: { item: true },
      });
    }

    return this.prisma.inventoryItem.findMany({
      where: {
        playerId,
        equipmentSlot: { is: null },
      },
      include: { item: true },
    });
  }

  /** Équipement simplifié pour les objets de session (hors EquipmentSlot persistant). */
  async equip(playerId: string, itemId: string) {
    const session = await this.gameSession.getActiveSession(playerId);
    if (!session) {
      throw new NotFoundException('Pas de session de jeu active');
    }
    const sessionItem = await (this.prisma as any).sessionItem.findUnique({
      where: { sessionId_playerId_itemId: { sessionId: session.id, playerId, itemId } },
    });
    if (!sessionItem) throw new NotFoundException('Item non trouvé');

    const updated = await (this.prisma as any).sessionItem.update({
      where: { id: sessionItem.id },
      data: { equipped: true },
      include: { item: true },
    });
    this.eventEmitter.emit(GAME_EVENTS.ITEM_EQUIPPED, { playerId, itemId });
    return updated;
  }

  async unequip(playerId: string, itemId: string) {
    const session = await this.gameSession.getActiveSession(playerId);
    if (!session) {
      throw new NotFoundException('Pas de session de jeu active');
    }
    const sessionItem = await (this.prisma as any).sessionItem.findUnique({
      where: { sessionId_playerId_itemId: { sessionId: session.id, playerId, itemId } },
    });
    if (!sessionItem) throw new NotFoundException('Item non trouvé');

    const updated = await (this.prisma as any).sessionItem.update({
      where: { id: sessionItem.id },
      data: { equipped: false },
      include: { item: true },
    });
    this.eventEmitter.emit(GAME_EVENTS.ITEM_UNEQUIPPED, { playerId, itemId });
    return updated;
  }

  async addResourceByName(playerId: string, resourceName: string) {
    const item = await this.prisma.item.findFirst({
      where: { name: resourceName },
    });
    if (!item) throw new NotFoundException(`Ressource introuvable: ${resourceName}`);

    const session = await this.gameSession.getActiveSession(playerId);
    if (session) {
      const existingSessionItem = await (this.prisma as any).sessionItem.findUnique({
        where: { sessionId_playerId_itemId: { sessionId: session.id, playerId, itemId: item.id } },
      });

      if (existingSessionItem) {
        return (this.prisma as any).sessionItem.update({
          where: { id: existingSessionItem.id },
          data: { quantity: { increment: 1 } },
        });
      }
      return (this.prisma as any).sessionItem.create({
        data: {
          sessionId: session.id,
          playerId,
          itemId: item.id,
          quantity: 1,
        },
      });
    }

    const existingInventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { playerId, itemId: item.id, rank: 1 },
    });

    if (existingInventoryItem) {
      return this.prisma.inventoryItem.update({
        where: { id: existingInventoryItem.id },
        data: { quantity: { increment: 1 } },
      });
    }
    return this.prisma.inventoryItem.create({
      data: {
        playerId,
        itemId: item.id,
        quantity: 1,
        rank: 1,
      },
    });
  }
}

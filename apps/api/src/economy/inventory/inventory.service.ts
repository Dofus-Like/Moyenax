import { GAME_EVENTS, type PlayerStats, ItemType } from '@game/shared-types';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { GameSessionService } from '../../game-session/game-session.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly gameSession: GameSessionService,
  ) {}

  private readonly POTION_STAT_MAP: Record<string, keyof PlayerStats> = {
    healVit: 'vit',
    buffAttaque: 'atk',
    buffPM: 'pm',
  };

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
    const sessionItem = await (this.prisma as any).sessionItem.findFirst({
      where: { sessionId: session.id, playerId, itemId },
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
    const sessionItem = await (this.prisma as any).sessionItem.findFirst({
      where: { sessionId: session.id, playerId, itemId },
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
      const existingSessionItem = await (this.prisma as any).sessionItem.findFirst({
        where: { sessionId: session.id, playerId, itemId: item.id },
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

  async useItem(playerId: string, itemId: string) {
    const session = await this.gameSession.getActiveSession(playerId);

    let inventoryRecord: any;
    let isSessionItem = false;

    if (session) {
      inventoryRecord = await (this.prisma as any).sessionItem.findFirst({
        where: { sessionId: session.id, playerId, itemId },
        include: { item: true },
      });
      isSessionItem = true;
    } else {
      inventoryRecord = await this.prisma.inventoryItem.findFirst({
        where: { playerId, itemId },
        include: { item: true },
      });
    }

    if (!inventoryRecord) {
      throw new NotFoundException('Objet introuvable dans votre inventaire');
    }

    const item = inventoryRecord.item;
    if (item.type !== ItemType.CONSUMABLE) {
      throw new BadRequestException('Cet objet ne peut pas être consommé');
    }

    const bonus = item.statsBonus as Record<string, number> | null;
    if (!bonus) {
      throw new BadRequestException('Cet objet n\'a aucun effet');
    }

    const statsUpdate: Record<string, number> = {};
    for (const [key, value] of Object.entries(bonus)) {
      const statKey = this.POTION_STAT_MAP[key];
      if (statKey && typeof value === 'number') {
        const baseKey = `base${statKey.charAt(0).toUpperCase() + statKey.slice(1)}`;
        statsUpdate[statKey] = { increment: value } as any;
        statsUpdate[baseKey] = { increment: value } as any;
      }
    }

    if (Object.keys(statsUpdate).length === 0) {
      throw new BadRequestException('Bonus d\'objet non reconnu');
    }

    await this.prisma.playerStats.update({
      where: { playerId },
      data: statsUpdate as any,
    });

    if (inventoryRecord.quantity > 1) {
      if (isSessionItem) {
        await (this.prisma as any).sessionItem.update({
          where: { id: inventoryRecord.id },
          data: { quantity: { decrement: 1 } },
        });
      } else {
        await this.prisma.inventoryItem.update({
          where: { id: inventoryRecord.id },
          data: { quantity: { decrement: 1 } },
        });
      }
    } else {
      if (isSessionItem) {
        await (this.prisma as any).sessionItem.delete({
          where: { id: inventoryRecord.id },
        });
      } else {
        await this.prisma.inventoryItem.delete({
          where: { id: inventoryRecord.id },
        });
      }
    }

    return this.findByPlayer(playerId);
  }
}

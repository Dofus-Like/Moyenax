import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../../shared/prisma/prisma.service';

import { EquipmentSlotType } from '@game/shared-types';
import { PlayerSpellProjectionService } from '../../player/player-spell-projection.service';
import { StatsCalculatorService } from '../../player/stats-calculator.service';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { GameSessionService } from '../../game-session/game-session.service';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsCalculator: StatsCalculatorService,
    private readonly playerSpellProjection: PlayerSpellProjectionService,
    private readonly perfLogger: PerfLoggerService,
    private readonly gameSession: GameSessionService,
  ) {}

  async getEquipment(playerId: string) {
    const slots = await this.prisma.equipmentSlot.findMany({
      where: { playerId },
      include: {
        inventoryItem: {
          include: {
            item: true,
          },
        },
        sessionItem: {
          include: {
            item: true,
          },
        },
      },
    });

    const equipment: Record<string, any> = {};
    Object.values(EquipmentSlotType).forEach((slot: any) => {
      const row = slots.find((s: any) => s.slot === slot);
      if (row?.inventoryItem) {
        equipment[slot] = row.inventoryItem;
      } else if (row?.sessionItem) {
        const si = row.sessionItem;
        equipment[slot] = {
          id: si.id,
          playerId: si.playerId,
          itemId: si.itemId,
          quantity: si.quantity,
          rank: 1,
          item: si.item,
        };
      } else {
        equipment[slot] = null;
      }
    });

    return equipment;
  }

  /** inventoryItemId ou id de SessionItem (même clé API) */
  async equip(playerId: string, inventoryItemId: string, slot: EquipmentSlotType) {
    const inv = await this.prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, playerId },
      include: { item: true },
    });

    if (inv) {
      this.validateSlotCompatibility(inv.item.type, slot);

      const existingSlotForItem = await this.prisma.equipmentSlot.findFirst({
        where: { playerId, inventoryItemId, NOT: { slot } },
      });

      if (existingSlotForItem) {
        await this.prisma.equipmentSlot.update({
          where: { id: existingSlotForItem.id },
          data: { inventoryItemId: null, sessionItemId: null },
        });
      }

      await this.prisma.equipmentSlot.upsert({
        where: {
          playerId_slot: { playerId, slot },
        },
        create: {
          playerId,
          slot,
          inventoryItemId,
          sessionItemId: null,
        },
        update: {
          inventoryItemId,
          sessionItemId: null,
        },
      });

      return this.updatePlayerStatsAndSpells(playerId);
    }

    const gs = await this.gameSession.getActiveSession(playerId);
    if (!gs) {
      throw new NotFoundException('Item non trouvé dans votre inventaire');
    }

    const si = await this.prisma.sessionItem.findFirst({
      where: { id: inventoryItemId, playerId, sessionId: gs.id },
      include: { item: true },
    });

    if (!si) {
      throw new NotFoundException('Item non trouvé dans votre inventaire');
    }

    this.validateSlotCompatibility(si.item.type, slot);

    const existingSlotForItem = await this.prisma.equipmentSlot.findFirst({
      where: { playerId, sessionItemId: inventoryItemId, NOT: { slot } },
    });

    if (existingSlotForItem) {
      await this.prisma.equipmentSlot.update({
        where: { id: existingSlotForItem.id },
        data: { inventoryItemId: null, sessionItemId: null },
      });
    }

    await this.prisma.equipmentSlot.upsert({
      where: {
        playerId_slot: { playerId, slot },
      },
      create: {
        playerId,
        slot,
        sessionItemId: inventoryItemId,
        inventoryItemId: null,
      },
      update: {
        sessionItemId: inventoryItemId,
        inventoryItemId: null,
      },
    });

    return this.updatePlayerStatsAndSpells(playerId);
  }

  async unequip(playerId: string, slot: EquipmentSlotType) {
    await this.prisma.equipmentSlot.update({
      where: {
        playerId_slot: { playerId, slot },
      },
      data: {
        inventoryItemId: null,
        sessionItemId: null,
      },
    });

    return this.updatePlayerStatsAndSpells(playerId);
  }

  private async updatePlayerStatsAndSpells(playerId: string) {
    const startedAt = performance.now();
    const [stats, equipment, playerSpellsData] = await Promise.all([
      this.statsCalculator.computeEffectiveStats(playerId),
      this.getEquipment(playerId),
      this.playerSpellProjection.buildPlayerSpellAssignments(playerId),
    ]);

    await this.prisma.$transaction([
      this.prisma.playerStats.update({
        where: { playerId },
        data: stats,
      }),
      this.prisma.playerSpell.deleteMany({
        where: { playerId },
      }),
      ...(playerSpellsData.length > 0
        ? [
            this.prisma.playerSpell.createMany({
              data: playerSpellsData,
            }),
          ]
        : []),
    ]);

    this.perfLogger.logDuration('player', 'equipment.recompute', performance.now() - startedAt, {
      player_id: playerId,
      spell_count: playerSpellsData.length,
    });

    return equipment;
  }

  private validateSlotCompatibility(itemType: string, slot: EquipmentSlotType) {
    const validSlots: Record<string, EquipmentSlotType[]> = {
      WEAPON: [EquipmentSlotType.WEAPON_LEFT, EquipmentSlotType.WEAPON_RIGHT],
      ARMOR_HEAD: [EquipmentSlotType.ARMOR_HEAD],
      ARMOR_CHEST: [EquipmentSlotType.ARMOR_CHEST],
      ARMOR_LEGS: [EquipmentSlotType.ARMOR_LEGS],
      ACCESSORY: [EquipmentSlotType.ACCESSORY],
    };

    if (!validSlots[itemType]?.includes(slot)) {
      throw new BadRequestException(`L'item de type ${itemType} ne peut pas être équipé dans le slot ${slot}`);
    }
  }
}

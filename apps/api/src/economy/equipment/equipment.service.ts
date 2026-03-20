import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../../shared/prisma/prisma.service';

import { EquipmentSlotType } from '@game/shared-types';
import { StatsCalculatorService } from '../../player/stats-calculator.service';
import { SpellResolverService } from '../../combat/spell-resolver.service';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsCalculator: StatsCalculatorService,
    private readonly spellResolver: SpellResolverService,
    private readonly perfLogger: PerfLoggerService,
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
      },
    });

    const equipment: Record<string, any> = {};
    Object.values(EquipmentSlotType).forEach((slot: any) => {
      equipment[slot] = slots.find((s) => s.slot === slot)?.inventoryItem || null;
    });

    return equipment;
  }


  async equip(playerId: string, inventoryItemId: string, slot: EquipmentSlotType) {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, playerId },
      include: { item: true },
    });

    if (!inventoryItem) {
      throw new NotFoundException('Item non trouvé dans votre inventaire');
    }

    this.validateSlotCompatibility(inventoryItem.item.type, slot);

    // Vérifier si l'item est déjà équipé dans un AUTRE slot
    const existingSlotForItem = await this.prisma.equipmentSlot.findFirst({
      where: { inventoryItemId, NOT: { slot } },
    });

    if (existingSlotForItem) {
      await this.prisma.equipmentSlot.update({
        where: { id: existingSlotForItem.id },
        data: { inventoryItemId: null },
      });
    }

    // Upsert le slot cible
    await this.prisma.equipmentSlot.upsert({
      where: {
        playerId_slot: { playerId, slot },
      },
      create: {
        playerId,
        slot,
        inventoryItemId,
      },
      update: {
        inventoryItemId,
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
      },
    });

    return this.updatePlayerStatsAndSpells(playerId);
  }

  private async updatePlayerStatsAndSpells(playerId: string) {
    const startedAt = performance.now();
    const [stats, equipment, allSpells] = await Promise.all([
      this.statsCalculator.computeEffectiveStats(playerId),
      this.getEquipment(playerId),
      this.prisma.spell.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const resolvedSpells = this.spellResolver.resolveSpells(equipment);
    const playerSpellsData: Array<{ playerId: string; spellId: string; level: number }> = [];

    for (const rs of resolvedSpells) {
      const dbSpell = allSpells.find((s) => s.name === rs.spellName);
      if (dbSpell) {
        playerSpellsData.push({
          playerId,
          spellId: dbSpell.id,
          level: rs.level,
        });
      }
    }

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

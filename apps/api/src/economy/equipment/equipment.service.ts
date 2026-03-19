import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

import { EquipmentSlotType } from '@game/shared-types';
import { StatsCalculatorService } from '../../player/stats-calculator.service';
import { SpellResolverService } from '../../combat/spell-resolver.service';

@Injectable()
export class EquipmentService {
  constructor(
    private prisma: PrismaService,
    private statsCalculator: StatsCalculatorService,
    private spellResolver: SpellResolverService
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

    await this.updatePlayerStatsAndSpells(playerId);

    return this.getEquipment(playerId);
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

    await this.updatePlayerStatsAndSpells(playerId);

    return this.getEquipment(playerId);
  }

  private async updatePlayerStatsAndSpells(playerId: string) {
    // 1. Stats
    const stats = await this.statsCalculator.computeEffectiveStats(playerId);
    await this.prisma.playerStats.update({
      where: { playerId },
      data: stats,
    });

    // 2. Spells
    const equipment = await this.getEquipment(playerId);
    const resolvedSpells = this.spellResolver.resolveSpells(equipment);

    // On récupère tous les spells de la DB pour mapper les noms aux IDs
    const allSpells = await this.prisma.spell.findMany();

    // Vider les anciens spells (simplification : on remplace tout)
    await this.prisma.playerSpell.deleteMany({
      where: { playerId },
    });

    // Créer les nouveaux
    for (const rs of resolvedSpells) {
      const dbSpell = allSpells.find((s) => s.name === rs.spellName);
      if (dbSpell) {
        await this.prisma.playerSpell.create({
          data: {
            playerId,
            spellId: dbSpell.id,
            level: rs.level,
          },
        });
      }
    }
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

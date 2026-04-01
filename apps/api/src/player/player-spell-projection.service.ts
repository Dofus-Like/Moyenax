import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SpellEffectKind as PrismaSpellEffectKind,
  SpellFamily as PrismaSpellFamily,
  SpellType as PrismaSpellType,
  SpellVisualType as PrismaSpellVisualType,
} from '@prisma/client';
import {
  SpellDefinition,
  SpellEffectKind,
  SpellFamily,
  SpellType,
  SpellVisualType,
} from '@game/shared-types';
import { PrismaService } from '../shared/prisma/prisma.service';

type SpellRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  paCost: number;
  minRange: number;
  maxRange: number;
  damageMin: number;
  damageMax: number;
  cooldown: number;
  type: PrismaSpellType;
  visualType: PrismaSpellVisualType;
  family: PrismaSpellFamily;
  iconPath: string | null;
  sortOrder: number;
  requiresLineOfSight: boolean;
  requiresLinearTargeting: boolean;
  effectKind: PrismaSpellEffectKind;
  effectConfig: Prisma.JsonValue | null;
};

@Injectable()
export class PlayerSpellProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPlayerSpellAssignments(playerId: string) {
    const projectedSpells = await this.getProjectedSpellRows(playerId);

    return projectedSpells.map((spell) => ({
      playerId,
      spellId: spell.id,
      level: 1,
    }));
  }

  async syncPlayerSpells(playerId: string) {
    const assignments = await this.buildPlayerSpellAssignments(playerId);

    await this.prisma.$transaction([
      this.prisma.playerSpell.deleteMany({
        where: { playerId },
      }),
      ...(assignments.length > 0
        ? [
            this.prisma.playerSpell.createMany({
              data: assignments,
            }),
          ]
        : []),
    ]);

    return assignments;
  }

  async getCombatSpellDefinitions(playerId: string): Promise<SpellDefinition[]> {
    let playerSpells = await this.prisma.playerSpell.findMany({
      where: { playerId },
      include: { spell: true },
    });

    if (playerSpells.length === 0) {
      await this.syncPlayerSpells(playerId);
      playerSpells = await this.prisma.playerSpell.findMany({
        where: { playerId },
        include: { spell: true },
      });
    }

    return playerSpells
      .map((entry) => entry.spell)
      .sort((left, right) => this.compareSpellRows(left, right))
      .map((spell) => this.toCombatDefinition(spell));
  }

  private async getProjectedSpellRows(playerId: string): Promise<SpellRow[]> {
    const equippedSlots = await this.prisma.equipmentSlot.findMany({
      where: {
        playerId,
        OR: [{ inventoryItemId: { not: null } }, { sessionItemId: { not: null } }],
      },
      select: {
        inventoryItem: { select: { itemId: true } },
        sessionItem: { select: { itemId: true } },
      },
    });

    const itemIds = [
      ...new Set(
        equippedSlots
          .map((slot) => slot.inventoryItem?.itemId ?? slot.sessionItem?.itemId ?? null)
          .filter((itemId): itemId is string => itemId !== null),
      ),
    ];

    const where: Prisma.SpellWhereInput = {
      OR: [
        { isDefault: true },
        ...(itemIds.length > 0
          ? [
              {
                grantedByItems: {
                  some: {
                    itemId: { in: itemIds },
                  },
                },
              },
            ]
          : []),
      ],
    };

    const projectedSpells = await this.prisma.spell.findMany({ where });
    return projectedSpells.sort((left, right) => this.compareSpellRows(left, right));
  }

  private compareSpellRows(left: Pick<SpellRow, 'sortOrder' | 'name' | 'code'>, right: Pick<SpellRow, 'sortOrder' | 'name' | 'code'>) {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name) || left.code.localeCompare(right.code);
  }

  private toCombatDefinition(spell: SpellRow): SpellDefinition {
    return {
      id: spell.code,
      code: spell.code,
      name: spell.name,
      description: spell.description,
      paCost: spell.paCost,
      minRange: spell.minRange,
      maxRange: spell.maxRange,
      damage: {
        min: spell.damageMin,
        max: spell.damageMax,
      },
      cooldown: spell.cooldown,
      type: spell.type as unknown as SpellType,
      visualType: spell.visualType as unknown as SpellVisualType,
      family: spell.family as unknown as SpellFamily,
      iconPath: spell.iconPath,
      sortOrder: spell.sortOrder,
      requiresLineOfSight: spell.requiresLineOfSight,
      requiresLinearTargeting: spell.requiresLinearTargeting,
      effectKind: spell.effectKind as unknown as SpellEffectKind,
      effectConfig: (spell.effectConfig as Record<string, unknown> | null) ?? null,
    };
  }
}

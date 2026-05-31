import { performance } from 'node:perf_hooks';

import { calculateDamage, calculateHeal } from '@game/game-engine';
import {
  type CombatPosition,
  type CombatState,
  type CombatPlayer,
  type SpellDefinition,
  type SpellEffectEntry,
  SpellEffectKind,
  TerrainType,
  TERRAIN_PROPERTIES,
} from '@game/shared-types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PerfStatsService } from '../../shared/perf/perf-stats.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateSpellDto } from './dto/create-spell.dto';

export type SpellRuntimeEvent =
  | {
      type: 'DAMAGE_DEALT';
      payload: {
        targetId: string;
        damage: number;
        remainingVit: number;
      };
    }
  | {
      type: 'HEAL_DEALT';
      payload: {
        targetId: string;
        heal: number;
        remainingVit: number;
      };
    }
  | {
      type: 'PLAYER_JUMPED';
      payload: {
        playerId: string;
        from: CombatPosition;
        to: CombatPosition;
      };
    };

export interface SpellExecutionResult {
  events: SpellRuntimeEvent[];
}

@Injectable()
export class SpellsService {
  private nextSummonSeq = 0;

  constructor(
    private readonly perfStats: PerfStatsService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(): Promise<SpellDefinition[]> {
    const rows = await this.prisma.spell.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map(this.mapToDefinition);
  }

  async findOne(id: string): Promise<SpellDefinition | null> {
    const row = await this.prisma.spell.findUnique({ where: { id } });
    return row ? this.mapToDefinition(row) : null;
  }

  async create(dto: CreateSpellDto): Promise<SpellDefinition> {
    const effectConfig: Prisma.InputJsonValue =
      dto.effectKind === 'EFFECTS_LIST' && dto.effects
        ? { effects: dto.effects.map((e) => ({ kind: e.kind, duration: e.duration, config: e.config })) } as unknown as Prisma.InputJsonValue
        : ((dto.effectConfig ?? {}) as Prisma.InputJsonValue);

    const row = await this.prisma.spell.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        paCost: dto.paCost,
        minRange: dto.minRange,
        maxRange: dto.maxRange,
        damageMin: dto.damage.min,
        damageMax: dto.damage.max,
        cooldown: dto.cooldown,
        type: dto.type,
        visualType: dto.visualType,
        family: dto.family,
        iconPath: dto.iconPath,
        sortOrder: dto.sortOrder,
        requiresLineOfSight: dto.requiresLineOfSight,
        requiresLinearTargeting: dto.requiresLinearTargeting,
        effectKind: dto.effectKind,
        effectConfig,
        isDefault: dto.isDefault ?? false,
      },
    });
    return this.mapToDefinition(row);
  }

  async update(id: string, dto: CreateSpellDto): Promise<SpellDefinition> {
    const existing = await this.prisma.spell.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Sort introuvable');

    const effectConfig: Prisma.InputJsonValue =
      dto.effectKind === 'EFFECTS_LIST' && dto.effects
        ? { effects: dto.effects.map((e) => ({ kind: e.kind, duration: e.duration, config: e.config })) } as unknown as Prisma.InputJsonValue
        : ((dto.effectConfig ?? {}) as Prisma.InputJsonValue);

    const row = await this.prisma.spell.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        paCost: dto.paCost,
        minRange: dto.minRange,
        maxRange: dto.maxRange,
        damageMin: dto.damage.min,
        damageMax: dto.damage.max,
        cooldown: dto.cooldown,
        type: dto.type,
        visualType: dto.visualType,
        family: dto.family,
        iconPath: dto.iconPath,
        sortOrder: dto.sortOrder,
        requiresLineOfSight: dto.requiresLineOfSight,
        requiresLinearTargeting: dto.requiresLinearTargeting,
        effectKind: dto.effectKind,
        effectConfig,
        isDefault: dto.isDefault ?? false,
      },
    });
    return this.mapToDefinition(row);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.spell.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Sort introuvable');
    await this.prisma.spell.delete({ where: { id } });
  }

  private mapToDefinition(row: {
    id: string; name: string; code: string; description: string | null;
    paCost: number; minRange: number; maxRange: number;
    damageMin: number; damageMax: number; cooldown: number;
    type: string; visualType: string; family: string;
    iconPath: string | null; sortOrder: number;
    requiresLineOfSight: boolean; requiresLinearTargeting: boolean;
    effectKind: string; effectConfig: unknown;
  }): SpellDefinition {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      paCost: row.paCost,
      minRange: row.minRange,
      maxRange: row.maxRange,
      damage: { min: row.damageMin, max: row.damageMax },
      cooldown: row.cooldown,
      type: row.type as SpellDefinition['type'],
      visualType: row.visualType as SpellDefinition['visualType'],
      family: row.family as SpellDefinition['family'],
      iconPath: row.iconPath,
      sortOrder: row.sortOrder,
      requiresLineOfSight: row.requiresLineOfSight,
      requiresLinearTargeting: row.requiresLinearTargeting,
      effectKind: row.effectKind as SpellDefinition['effectKind'],
      effectConfig: (row.effectConfig ?? null) as Record<string, unknown> | null,
    };
  }

  executeEffect(
    state: CombatState,
    spell: SpellDefinition,
    caster: CombatPlayer,
    targetPos: CombatPosition,
  ): SpellExecutionResult {
    const startedAt = performance.now();
    try {
      switch (spell.effectKind) {
        case SpellEffectKind.DAMAGE_PHYSICAL:
          return this.applyDamage(state, targetPos, spell, caster, false);
        case SpellEffectKind.DAMAGE_MAGICAL:
          return this.applyDamage(state, targetPos, spell, caster, true);
        case SpellEffectKind.HEAL:
          return this.applyHeal(state, targetPos, spell, caster.stats);
        case SpellEffectKind.TELEPORT:
          return this.applyTeleport(state, caster, targetPos);
        case SpellEffectKind.BUFF_VIT_MAX:
          return this.applyVitBuff(caster, spell.effectConfig);
        case SpellEffectKind.SUMMON_MENHIR:
          return this.applySummonMenhir(state, targetPos, caster.playerId, spell.effectConfig);
        case SpellEffectKind.PUSH_LINE:
          return this.applyPush(state, caster.position, targetPos, spell.effectConfig);
        case SpellEffectKind.BUFF_PM:
          return this.applyPmBuff(caster, spell.effectConfig);
        case SpellEffectKind.EFFECTS_LIST:
          return this.applyEffectsList(state, spell, caster, targetPos);
        case SpellEffectKind.BRULURE:
          return this.applyBrulure(state, targetPos, spell.effectConfig);
        case SpellEffectKind.SAIGNEMENT:
          return this.applySaignement(state, targetPos, spell.effectConfig);
        case SpellEffectKind.ATTRACTION:
          return this.applyAttraction(state, caster.position, targetPos, spell.effectConfig);
        case SpellEffectKind.FAIBLESSE:
          return this.applyMalus(state, targetPos, 'ATK', spell.effectConfig);
        case SpellEffectKind.FRAGILITE:
          return this.applyMalus(state, targetPos, 'DEF', spell.effectConfig);
        case SpellEffectKind.IGNORANCE:
          return this.applyMalus(state, targetPos, 'MAG', spell.effectConfig);
        case SpellEffectKind.MALEDICTION:
          return this.applyMalus(state, targetPos, 'RES', spell.effectConfig);
        case SpellEffectKind.CECITE:
          return this.applyMalus(state, targetPos, 'PO', spell.effectConfig);
        case SpellEffectKind.INACTIVITE:
          return this.applyInactivite(state, targetPos, spell.effectConfig);
        case SpellEffectKind.RALENTISSEMENT:
          return this.applyRalentissement(state, targetPos, spell.effectConfig);
        case SpellEffectKind.HEMORRAGIE:
          return this.applyHemorrhage(state, targetPos, spell.effectConfig);
        default:
          throw new BadRequestException(`Effet de sort non supporté: ${spell.effectKind}`);
      }
    } finally {
      this.perfStats.recordGameMetric('game.spell', spell.effectKind, performance.now() - startedAt);
    }
  }

  private applyDamage(
    state: CombatState,
    targetPos: CombatPosition,
    spell: SpellDefinition,
    caster: CombatPlayer,
    isMagical: boolean,
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );

    if (!targetPlayer) {
      return { events: [] };
    }

    const defBuffs = targetPlayer.buffs
      .filter((buff) => buff.type === 'DEF')
      .reduce((sum, buff) => sum + buff.value, 0);
    const resBuffs = targetPlayer.buffs
      .filter((buff) => buff.type === 'RES')
      .reduce((sum, buff) => sum + buff.value, 0);

    const atkBuffs = caster.buffs
      .filter((buff) => buff.type === 'ATK')
      .reduce((sum, buff) => sum + buff.value, 0);
    const magBuffs = caster.buffs
      .filter((buff) => buff.type === 'MAG')
      .reduce((sum, buff) => sum + buff.value, 0);

    const effectiveTargetStats = {
      ...targetPlayer.stats,
      def: targetPlayer.stats.def + defBuffs,
      res: targetPlayer.stats.res + resBuffs,
    };

    const effectiveCasterStats = {
      ...caster.stats,
      atk: caster.stats.atk + atkBuffs,
      mag: caster.stats.mag + magBuffs,
    };

    const damage = calculateDamage(spell, effectiveCasterStats, effectiveTargetStats, isMagical);
    targetPlayer.currentVit = Math.max(0, targetPlayer.currentVit - damage);

    if (targetPlayer.type === 'SUMMON' && targetPlayer.currentVit <= 0) {
      delete state.players[targetPlayer.playerId];
    }

    return {
      events: [
        {
          type: 'DAMAGE_DEALT',
          payload: {
            targetId: targetPlayer.playerId,
            damage,
            remainingVit: targetPlayer.currentVit,
          },
        },
      ],
    };
  }

  private applyHeal(
    state: CombatState,
    targetPos: CombatPosition,
    spell: SpellDefinition,
    attackerStats: CombatPlayer['stats'],
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );

    if (!targetPlayer) {
      return { events: [] };
    }

    const heal = calculateHeal(spell, attackerStats);
    targetPlayer.currentVit = Math.min(targetPlayer.stats.vit, targetPlayer.currentVit + heal);

    return {
      events: [
        {
          type: 'HEAL_DEALT',
          payload: {
            targetId: targetPlayer.playerId,
            heal,
            remainingVit: targetPlayer.currentVit,
          },
        },
      ],
    };
  }

  private applyTeleport(
    state: CombatState,
    caster: CombatPlayer,
    targetPos: CombatPosition,
  ): SpellExecutionResult {
    const occupied = Object.values(state.players).some(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );
    if (occupied) {
      throw new BadRequestException('Case occupée');
    }

    const tile = state.map.tiles.find(
      (entry) => entry.x === targetPos.x && entry.y === targetPos.y,
    );
    if (!tile || !(TERRAIN_PROPERTIES[tile.type as TerrainType]?.traversable ?? false)) {
      throw new BadRequestException('Terrain invalide');
    }

    const from = { ...caster.position };
    caster.position = targetPos;

    return {
      events: [
        {
          type: 'PLAYER_JUMPED',
          payload: {
            playerId: caster.playerId,
            from,
            to: targetPos,
          },
        },
      ],
    };
  }

  private applyVitBuff(
    caster: CombatPlayer,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const buffValue = this.readNumber(effectConfig, 'buffValue', 20);
    const buffDuration = this.readNumber(effectConfig, 'buffDuration', 99);

    // Dedup: un seul VIT_MAX actif à la fois.
    // Si un buff existant a déjà augmenté stats.vit, on soustrait l'ancienne valeur
    // avant d'appliquer la nouvelle, pour éviter le stacking permanent.
    const existing = caster.buffs.find((b) => b.type === 'VIT_MAX');
    if (existing) {
      caster.stats.vit -= existing.value;
      existing.value = buffValue;
      existing.remainingTurns = buffDuration;
    } else {
      caster.buffs.push({ type: 'VIT_MAX', value: buffValue, remainingTurns: buffDuration });
    }

    caster.stats.vit += buffValue;
    caster.currentVit = Math.min(caster.stats.vit, caster.currentVit + buffValue);

    return { events: [] };
  }

  private applySummonMenhir(
    state: CombatState,
    targetPos: CombatPosition,
    casterId: string,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const occupied = Object.values(state.players).some(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );
    if (occupied) {
      throw new BadRequestException('Case occupée');
    }

    const tile = state.map.tiles.find(
      (entry) => entry.x === targetPos.x && entry.y === targetPos.y,
    );
    if (!tile) {
      throw new BadRequestException('Case introuvable');
    }

    const rawStats = (effectConfig?.stats as Record<string, number> | undefined) ?? {
      vit: 1,
      atk: 0,
      mag: 0,
      def: 0,
      res: 0,
      ini: 0,
      pa: 0,
      pm: 0,
      baseVit: 1,
      baseAtk: 0,
      baseMag: 0,
      baseDef: 0,
      baseRes: 0,
      baseIni: 0,
      basePa: 0,
      basePm: 0,
    };

    const summonId = `summon-menhir-${Date.now()}-${this.nextSummonSeq++}`;
    state.players[summonId] = {
      playerId: summonId,
      username: 'Menhir',
      type: 'SUMMON',
      casterId,
      stats: rawStats as unknown as CombatPlayer['stats'],
      currentVit: rawStats.vit ?? 1,
      position: { ...targetPos },
      spells: [],
      remainingPa: rawStats.pa ?? 0,
      remainingPm: rawStats.pm ?? 0,
      spellCooldowns: {},
      buffs: [],
      skin: typeof effectConfig?.skin === 'string' ? effectConfig.skin : 'menhir',
    };

    return { events: [] };
  }

  private applyPush(
    state: CombatState,
    casterPos: CombatPosition,
    targetPos: CombatPosition,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );

    if (!targetPlayer) {
      return { events: [] };
    }

    const dx = Math.abs(targetPos.x - casterPos.x);
    const dy = Math.abs(targetPos.y - casterPos.y);
    if (dx > 0 && dy > 0) {
      throw new BadRequestException('Lancer en ligne uniquement');
    }

    const pushDistance = this.readNumber(effectConfig, 'pushDistance', 3);
    const pushX = Math.sign(targetPos.x - casterPos.x);
    const pushY = Math.sign(targetPos.y - casterPos.y);

    let finalPos = { ...targetPlayer.position };
    for (let index = 0; index < pushDistance; index += 1) {
      const next = { x: finalPos.x + pushX, y: finalPos.y + pushY };
      if (next.x < 0 || next.x >= state.map.width || next.y < 0 || next.y >= state.map.height) {
        break;
      }

      const tile = state.map.tiles.find((entry) => entry.x === next.x && entry.y === next.y);
      if (!tile || !(TERRAIN_PROPERTIES[tile.type as TerrainType]?.traversable ?? false)) {
        break;
      }

      if (
        Object.values(state.players).some(
          (player) =>
            player.playerId !== targetPlayer.playerId &&
            player.position.x === next.x &&
            player.position.y === next.y,
        )
      ) {
        break;
      }

      finalPos = next;
    }

    targetPlayer.position = finalPos;
    return { events: [] };
  }

  private applyPmBuff(
    caster: CombatPlayer,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const buffValue = this.readNumber(effectConfig, 'buffValue', 2);
    const buffDuration = this.readNumber(effectConfig, 'buffDuration', 1);
    const applyImmediately = effectConfig?.applyImmediately !== false;

    // Dedup: un seul buff PM actif à la fois (refresh durée + remplace valeur).
    // Le cumul précédent permettait un spam sans limite de remainingPm.
    const existing = caster.buffs.find((b) => b.type === 'PM');
    if (existing) {
      // On ne re-applique l'effet immédiat que si la nouvelle valeur est strictement supérieure,
      // et seulement le delta.
      if (applyImmediately && buffValue > existing.value) {
        caster.remainingPm += buffValue - existing.value;
      }
      existing.value = Math.max(existing.value, buffValue);
      existing.remainingTurns = Math.max(existing.remainingTurns, buffDuration);
    } else {
      caster.buffs.push({ type: 'PM', value: buffValue, remainingTurns: buffDuration });
      if (applyImmediately) {
        caster.remainingPm += buffValue;
      }
    }

    return { events: [] };
  }

  private applyEffectsList(
    state: CombatState,
    spell: SpellDefinition,
    caster: CombatPlayer,
    targetPos: CombatPosition,
  ): SpellExecutionResult {
    const effects = (spell.effectConfig?.effects as SpellEffectEntry[] | undefined) ?? [];
    const allEvents: SpellRuntimeEvent[] = [];

    for (const entry of effects) {
      const subConfig: Record<string, unknown> = { ...entry.config };
      if (entry.duration != null) {
        subConfig.buffDuration = entry.duration;
      }

      const subSpell: SpellDefinition = {
        ...spell,
        effectKind: entry.kind,
        effectConfig: subConfig,
      };

      const subResult = this.executeEffect(state, subSpell, caster, targetPos);
      allEvents.push(...subResult.events);
    }

    return { events: allEvents };
  }

  private applyBrulure(
    state: CombatState,
    targetPos: CombatPosition,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    return this.applyDot(state, targetPos, 'BURN', effectConfig);
  }

  private applySaignement(
    state: CombatState,
    targetPos: CombatPosition,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    return this.applyDot(state, targetPos, 'BLEED', effectConfig);
  }

  private applyDot(
    state: CombatState,
    targetPos: CombatPosition,
    buffType: 'BURN' | 'BLEED',
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );
    if (!targetPlayer) return { events: [] };

    const damagePerTick = this.readNumber(effectConfig, 'damagePerTick', 5);
    const duration = this.readNumber(effectConfig, 'buffDuration', 3);

    const existing = targetPlayer.buffs.find((b) => b.type === buffType);
    if (existing) {
      existing.value = Math.max(existing.value, damagePerTick);
      existing.remainingTurns = Math.max(existing.remainingTurns, duration);
    } else {
      targetPlayer.buffs.push({ type: buffType, value: damagePerTick, remainingTurns: duration });
    }

    return { events: [] };
  }

  private applyAttraction(
    state: CombatState,
    casterPos: CombatPosition,
    targetPos: CombatPosition,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );
    if (!targetPlayer) return { events: [] };

    const dx = Math.abs(targetPos.x - casterPos.x);
    const dy = Math.abs(targetPos.y - casterPos.y);
    if (dx > 0 && dy > 0) {
      throw new BadRequestException('Lancer en ligne uniquement');
    }

    const pullDistance = this.readNumber(effectConfig, 'pushDistance', 3);
    const pullX = Math.sign(casterPos.x - targetPos.x);
    const pullY = Math.sign(casterPos.y - targetPos.y);

    let finalPos = { ...targetPlayer.position };
    for (let index = 0; index < pullDistance; index += 1) {
      const next = { x: finalPos.x + pullX, y: finalPos.y + pullY };
      if (next.x < 0 || next.x >= state.map.width || next.y < 0 || next.y >= state.map.height) {
        break;
      }

      const tile = state.map.tiles.find((entry) => entry.x === next.x && entry.y === next.y);
      if (!tile || !(TERRAIN_PROPERTIES[tile.type as TerrainType]?.traversable ?? false)) {
        break;
      }

      if (
        Object.values(state.players).some(
          (player) =>
            player.playerId !== targetPlayer.playerId &&
            player.position.x === next.x &&
            player.position.y === next.y,
        )
      ) {
        break;
      }

      finalPos = next;
    }

    targetPlayer.position = finalPos;
    return { events: [] };
  }

  private applyMalus(
    state: CombatState,
    targetPos: CombatPosition,
    buffType: 'ATK' | 'DEF' | 'MAG' | 'RES' | 'PO',
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );
    if (!targetPlayer) return { events: [] };

    const buffValue = -Math.abs(this.readNumber(effectConfig, 'buffValue', 3));
    const buffDuration = this.readNumber(effectConfig, 'buffDuration', 3);

    const existing = targetPlayer.buffs.find((b) => b.type === buffType);
    if (existing) {
      existing.value = Math.min(existing.value, buffValue);
      existing.remainingTurns = Math.max(existing.remainingTurns, buffDuration);
    } else {
      targetPlayer.buffs.push({ type: buffType, value: buffValue, remainingTurns: buffDuration });
    }

    return { events: [] };
  }

  private applyInactivite(
    state: CombatState,
    targetPos: CombatPosition,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );
    if (!targetPlayer) return { events: [] };

    const buffValue = -Math.abs(this.readNumber(effectConfig, 'buffValue', 2));
    const buffDuration = this.readNumber(effectConfig, 'buffDuration', 2);

    const existing = targetPlayer.buffs.find((b) => b.type === 'PA');
    if (existing) {
      targetPlayer.remainingPa += existing.value;
      existing.value = Math.min(existing.value, buffValue);
      existing.remainingTurns = Math.max(existing.remainingTurns, buffDuration);
    } else {
      targetPlayer.buffs.push({ type: 'PA', value: buffValue, remainingTurns: buffDuration });
    }

    targetPlayer.remainingPa += buffValue;
    if (targetPlayer.remainingPa < 0) targetPlayer.remainingPa = 0;

    return { events: [] };
  }

  private applyRalentissement(
    state: CombatState,
    targetPos: CombatPosition,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );
    if (!targetPlayer) return { events: [] };

    const buffValue = -Math.abs(this.readNumber(effectConfig, 'buffValue', 2));
    const buffDuration = this.readNumber(effectConfig, 'buffDuration', 2);

    const existing = targetPlayer.buffs.find((b) => b.type === 'PM');
    if (existing) {
      targetPlayer.remainingPm += existing.value;
      existing.value = Math.min(existing.value, buffValue);
      existing.remainingTurns = Math.max(existing.remainingTurns, buffDuration);
    } else {
      targetPlayer.buffs.push({ type: 'PM', value: buffValue, remainingTurns: buffDuration });
    }

    targetPlayer.remainingPm += buffValue;
    if (targetPlayer.remainingPm < 0) targetPlayer.remainingPm = 0;

    return { events: [] };
  }

  private applyHemorrhage(
    state: CombatState,
    targetPos: CombatPosition,
    effectConfig: Record<string, unknown> | null,
  ): SpellExecutionResult {
    const targetPlayer = Object.values(state.players).find(
      (player) => player.position.x === targetPos.x && player.position.y === targetPos.y,
    );
    if (!targetPlayer) return { events: [] };

    const buffValue = -Math.abs(this.readNumber(effectConfig, 'buffValue', 15));
    const buffDuration = this.readNumber(effectConfig, 'buffDuration', 3);

    const existing = targetPlayer.buffs.find((b) => b.type === 'VIT_MAX');
    if (existing) {
      targetPlayer.stats.vit -= existing.value;
      existing.value = Math.min(existing.value, buffValue);
      existing.remainingTurns = Math.max(existing.remainingTurns, buffDuration);
    } else {
      targetPlayer.buffs.push({ type: 'VIT_MAX', value: buffValue, remainingTurns: buffDuration });
    }

    targetPlayer.stats.vit += buffValue;
    targetPlayer.currentVit = Math.max(0, Math.min(targetPlayer.stats.vit, targetPlayer.currentVit + buffValue));

    return { events: [] };
  }

  private readNumber(effectConfig: Record<string, unknown> | null, key: string, fallback: number) {
    const candidate = effectConfig?.[key];
    return typeof candidate === 'number' ? candidate : fallback;
  }
}

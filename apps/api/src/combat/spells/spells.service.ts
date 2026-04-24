import { BadRequestException, Injectable } from '@nestjs/common';
import { calculateDamage, calculateHeal } from '@game/game-engine';
import { performance } from 'node:perf_hooks';
import {
  type CombatPosition,
  type CombatState,
  type CombatPlayer,
  type SpellDefinition,
  SpellEffectKind,
  TerrainType,
  TERRAIN_PROPERTIES,
} from '@game/shared-types';
import { PerfStatsService } from '../../shared/perf/perf-stats.service';

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
  constructor(private readonly perfStats: PerfStatsService) {}

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
          return this.applyDamage(state, targetPos, spell, caster.stats, false);
        case SpellEffectKind.DAMAGE_MAGICAL:
          return this.applyDamage(state, targetPos, spell, caster.stats, true);
        case SpellEffectKind.HEAL:
          return this.applyHeal(state, targetPos, spell, caster.stats);
        case SpellEffectKind.TELEPORT:
          return this.applyTeleport(state, caster, targetPos);
        case SpellEffectKind.BUFF_VIT_MAX:
          return this.applyVitBuff(caster, spell.effectConfig);
        case SpellEffectKind.SUMMON_MENHIR:
          return this.applySummonMenhir(state, targetPos, spell.effectConfig);
        case SpellEffectKind.PUSH_LINE:
          return this.applyPush(state, caster.position, targetPos, spell.effectConfig);
        case SpellEffectKind.BUFF_PM:
          return this.applyPmBuff(caster, spell.effectConfig);
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
    attackerStats: CombatPlayer['stats'],
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

    const effectiveStats = {
      ...targetPlayer.stats,
      def: targetPlayer.stats.def + defBuffs,
      res: targetPlayer.stats.res + resBuffs,
    };

    const damage = calculateDamage(spell, attackerStats, effectiveStats, isMagical);
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

    caster.stats.vit += buffValue;
    caster.currentVit += buffValue;
    caster.buffs.push({ type: 'VIT_MAX', value: buffValue, remainingTurns: buffDuration });

    return { events: [] };
  }

  private applySummonMenhir(
    state: CombatState,
    targetPos: CombatPosition,
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

    const summonId = `summon-menhir-${Date.now()}`;
    state.players[summonId] = {
      playerId: summonId,
      username: 'Menhir',
      type: 'SUMMON',
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

    caster.buffs.push({ type: 'PM', value: buffValue, remainingTurns: buffDuration });
    if (applyImmediately) {
      caster.remainingPm += buffValue;
    }

    return { events: [] };
  }

  private readNumber(effectConfig: Record<string, unknown> | null, key: string, fallback: number) {
    const candidate = effectConfig?.[key];
    return typeof candidate === 'number' ? candidate : fallback;
  }
}

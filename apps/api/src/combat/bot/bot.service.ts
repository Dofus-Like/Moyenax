// Bot service for handles AI turns
import { performance } from 'node:perf_hooks';

import { isInRange } from '@game/game-engine';
import {
  GAME_EVENTS,
  CombatState,
  CombatActionType,
  TerrainType,
  GameMap,
  findPathToAdjacent,
} from '@game/shared-types';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PerfStatsService } from '../../shared/perf/perf-stats.service';
import { RedisService } from '../../shared/redis/redis.service';
import { TurnService } from '../turn/turn.service';

@Injectable()
export class BotService {
  constructor(
    private readonly turnService: TurnService,
    private readonly redis: RedisService,
    private readonly perfStats: PerfStatsService,
  ) {}

  @OnEvent(GAME_EVENTS.TURN_STARTED)
  async handleTurnStarted(payload: { sessionId: string; playerId: string }) {
    const { sessionId, playerId } = payload;

    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);
    if (!state) return;

    const player = state.players[playerId];
    if (!player || !player.username.toLowerCase().includes('bot')) return;

    // Délai réduit pour la première action car le bot est réactif
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      await this.makeMove(sessionId, playerId);
    } catch (e) {
      console.error(`[BotService] Error during bot turn:`, e);
      // Forcer la fin du tour si erreur pour ne pas bloquer le combat
      try {
        await this.turnService.forcePlayAction(sessionId, playerId, {
          type: CombatActionType.END_TURN,
        });
      } catch (endErr) {
        console.error(`[BotService] Failed to force end turn:`, endErr);
      }
    }
  }

  private async makeMove(sessionId: string, botId: string, afterMove = false): Promise<void> {
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);
    if (!state) return;

    const bot = state.players[botId];
    if (!bot) return;

    // Trouver l'adversaire le plus proche
    const enemy = Object.values(state.players).find((p) => p.playerId !== botId);
    if (!enemy) {
      await this.turnService.forcePlayAction(sessionId, botId, { type: CombatActionType.END_TURN });
      return;
    }

    // 1. Tenter de lancer un sort si à portée
    const spell = bot.spells[0];
    if (spell && bot.remainingPa >= spell.paCost) {
      if (isInRange(bot.position, enemy.position, spell.minRange, spell.maxRange)) {
        // Si on vient de se déplacer, on attend un peu que l'animation de fin de course se termine
        if (afterMove) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }

        // Petite pause avant de lancer le sort pour simuler l'incantation/visée
        await new Promise((resolve) => setTimeout(resolve, 300));

        await this.turnService.forcePlayAction(sessionId, botId, {
          type: CombatActionType.CAST_SPELL,
          spellId: spell.id,
          targetX: enemy.position.x,
          targetY: enemy.position.y,
        });
        // Délai après l'attaque pour laisser les animations se jouer
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Récursif pour vider les PA si possible (pas considéré comme un move)
        return this.makeMove(sessionId, botId, false);
      }
    }

    // 2. Sinon, se rapprocher si PM > 0
    if (bot.remainingPm > 0) {
      // ... (Building gameMap and occupiedSet)
      const grid = Array.from({ length: state.map.height }, () =>
        Array(state.map.width).fill(TerrainType.GROUND),
      );
      for (const t of state.map.tiles) {
        if (grid[t.y]) grid[t.y][t.x] = t.type;
      }
      const gameMap: GameMap = {
        width: state.map.width,
        height: state.map.height,
        grid,
        seedId: 'FORGE',
      };

      const occupiedSet = new Set<string>();
      for (const p of Object.values(state.players)) {
        if (p.playerId !== botId) {
          occupiedSet.add(`${p.position.x},${p.position.y}`);
        }
      }

      const pathStartedAt = performance.now();
      const path = findPathToAdjacent(gameMap, bot.position, enemy.position, occupiedSet);
      this.perfStats.recordGameMetric(
        'game.pathfinding',
        'bot.findPathToAdjacent',
        performance.now() - pathStartedAt,
      );

      if (path && path.length > 0) {
        const nextStep = path[0];

        try {
          await this.turnService.forcePlayAction(sessionId, botId, {
            type: CombatActionType.MOVE,
            targetX: nextStep.x,
            targetY: nextStep.y,
          });
          // On repart immédiatement pour le prochain pas (pas de délai ici pour la fluidité)
          return this.makeMove(sessionId, botId, true);
        } catch (e) {
        }
      }
    }

    // 3. Fin du tour
    await new Promise((resolve) => setTimeout(resolve, 500));
    await this.turnService.forcePlayAction(sessionId, botId, { type: CombatActionType.END_TURN });
  }
}

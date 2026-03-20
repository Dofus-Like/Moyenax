// Bot service for handles AI turns
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GAME_EVENTS, CombatState, CombatActionType } from '@game/shared-types';
import { TurnService } from '../turn/turn.service';
import { isInRange } from '@game/game-engine';
import { RedisService } from '../../shared/redis/redis.service';

@Injectable()
export class BotService {
  constructor(
    private readonly turnService: TurnService,
    private readonly redis: RedisService,
  ) {}

  @OnEvent(GAME_EVENTS.TURN_STARTED)
  async handleTurnStarted(payload: { sessionId: string; playerId: string }) {
    const { sessionId, playerId } = payload;
    
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);
    if (!state) return;

    const player = state.players[playerId];
    if (!player || !player.username.toLowerCase().includes('bot')) return;

    console.log(`[BotService] Bot ${player.username} is thinking... (Session: ${sessionId})`);
    
    // Petit délai pour simuler la réflexion
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      await this.makeMove(sessionId, playerId);
    } catch (e) {
      console.error(`[BotService] Error during bot turn:`, e);
      // Forcer la fin du tour si erreur pour ne pas bloquer le combat
      try {
        await this.turnService.forcePlayAction(sessionId, playerId, { type: CombatActionType.END_TURN });
      } catch (endErr) {
        console.error(`[BotService] Failed to force end turn:`, endErr);
      }
    }
  }

  private async makeMove(sessionId: string, botId: string): Promise<void> {
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);
    if (!state) return;

    const bot = state.players[botId];
    if (!bot) return;

    // Trouver l'adversaire le plus proche
    const enemy = Object.values(state.players).find(p => p.playerId !== botId);
    if (!enemy) {
        await this.turnService.forcePlayAction(sessionId, botId, { type: CombatActionType.END_TURN });
        return;
    }

    // 1. Tenter de lancer un sort si à portée
    const spell = bot.spells[0]; // On prend le premier (Frappe par défaut)
    if (spell && bot.remainingPa >= spell.paCost) {
        if (isInRange(bot.position, enemy.position, spell.minRange, spell.maxRange)) {
            console.log(`[BotService] Bot casting ${spell.name} on ${enemy.username}`);
            await this.turnService.forcePlayAction(sessionId, botId, {
                type: CombatActionType.CAST_SPELL,
                spellId: spell.id,
                targetX: enemy.position.x,
                targetY: enemy.position.y
            });
            // Récursif pour vider les PA si possible
            return this.makeMove(sessionId, botId);
        }
    }

    // 2. Sinon, se rapprocher si PM > 0
    if (bot.remainingPm > 0) {
        const dx = enemy.position.x - bot.position.x;
        const dy = enemy.position.y - bot.position.y;
        
        // Si déjà adjacent, on ne bouge plus (sauf si on veut s'échapper, mais ici c'est un bot basique)
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > 1) {
            let targetX = bot.position.x;
            let targetY = bot.position.y;

            if (Math.abs(dx) > Math.abs(dy)) {
                targetX += Math.sign(dx);
            } else {
                targetY += Math.sign(dy);
            }

            console.log(`[BotService] Bot moving from ${bot.position.x},${bot.position.y} to ${targetX},${targetY}`);
            try {
                await this.turnService.forcePlayAction(sessionId, botId, {
                    type: CombatActionType.MOVE,
                    targetX,
                    targetY
                });
                return this.makeMove(sessionId, botId);
            } catch {
                console.log(`[BotService] Bot move blocked at ${targetX},${targetY}.`);
            }
        }
    }

    // 3. Fin du tour
    console.log(`[BotService] Bot ending turn.`);
    await this.turnService.forcePlayAction(sessionId, botId, { type: CombatActionType.END_TURN });
  }
}

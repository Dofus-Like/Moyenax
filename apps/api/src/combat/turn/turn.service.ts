import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { CombatState, CombatAction, CombatActionType } from '@game/shared-types';
import { canMoveToPosition } from '@game/game-engine';

@Injectable()
export class TurnService {
  constructor(
    private readonly redis: RedisService,
    private readonly sse: SseService,
  ) {}

  async playAction(
    sessionId: string,
    playerId: string,
    action: CombatAction,
  ): Promise<CombatState> {
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);

    if (!state) {
      throw new BadRequestException('Session de combat introuvable');
    }

    if (state.currentTurnPlayerId !== playerId) {
      throw new BadRequestException('Ce n\'est pas votre tour');
    }

    const player = state.players[playerId];
    if (!player) {
      throw new BadRequestException('Joueur introuvable dans la session');
    }

    switch (action.type) {
      case CombatActionType.MOVE:
        return this.handleMove(state, playerId, action);

      case CombatActionType.CAST_SPELL:
        return this.handleCastSpell(state, playerId, action);

      case CombatActionType.END_TURN:
        return this.handleEndTurn(state, playerId);

      default:
        throw new BadRequestException('Action invalide');
    }
  }

  private async handleMove(
    state: CombatState,
    playerId: string,
    action: CombatAction,
  ): Promise<CombatState> {
    const player = state.players[playerId];
    const targetX = action.targetX ?? 0;
    const targetY = action.targetY ?? 0;
    const target = { x: targetX, y: targetY };

    if (!canMoveToPosition(player.position, target, player.remainingMp, state.map.obstacles)) {
      throw new BadRequestException('Déplacement impossible');
    }

    const distance = Math.abs(target.x - player.position.x) + Math.abs(target.y - player.position.y);
    player.position = target;
    player.remainingMp -= distance;

    await this.redis.setJson(`combat:${state.sessionId}`, state, 3600);
    this.sse.emit(state.sessionId, 'combat:update', state);

    return state;
  }

  private async handleCastSpell(
    state: CombatState,
    playerId: string,
    action: CombatAction,
  ): Promise<CombatState> {
    const player = state.players[playerId];
    const spell = player.spells.find((s) => s.id === action.spellId);

    if (!spell) {
      throw new BadRequestException('Sort introuvable');
    }

    if (player.remainingAp < spell.apCost) {
      throw new BadRequestException('PA insuffisants');
    }

    const cooldown = player.spellCooldowns[spell.id] ?? 0;
    if (cooldown > 0) {
      throw new BadRequestException('Sort en cooldown');
    }

    player.remainingAp -= spell.apCost;
    if (spell.cooldown > 0) {
      player.spellCooldowns[spell.id] = spell.cooldown;
    }

    await this.redis.setJson(`combat:${state.sessionId}`, state, 3600);
    this.sse.emit(state.sessionId, 'combat:update', state);

    return state;
  }

  private async handleEndTurn(
    state: CombatState,
    playerId: string,
  ): Promise<CombatState> {
    const playerIds = Object.keys(state.players);
    const currentIndex = playerIds.indexOf(playerId);
    const nextIndex = (currentIndex + 1) % playerIds.length;

    state.currentTurnPlayerId = playerIds[nextIndex];
    state.turnNumber += 1;

    // Réinitialiser AP/MP du prochain joueur
    const nextPlayer = state.players[state.currentTurnPlayerId];
    nextPlayer.remainingAp = nextPlayer.stats.maxAp;
    nextPlayer.remainingMp = nextPlayer.stats.maxMp;

    // Décrémenter les cooldowns
    for (const spellId of Object.keys(nextPlayer.spellCooldowns)) {
      nextPlayer.spellCooldowns[spellId] = Math.max(0, nextPlayer.spellCooldowns[spellId] - 1);
    }

    await this.redis.setJson(`combat:${state.sessionId}`, state, 3600);
    this.sse.emit(state.sessionId, 'combat:turn', state);

    return state;
  }
}

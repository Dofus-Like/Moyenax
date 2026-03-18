import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { CombatState, CombatAction, CombatActionType, CombatPosition, SpellType, TerrainType, TERRAIN_PROPERTIES } from '@game/shared-types';
import { 
  canMoveTo, 
  canJumpTo, 
  calculateDamage, 
  calculateHeal, 
  isInRange, 
  hasLineOfSight,
} from '@game/game-engine';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GAME_EVENTS } from '@game/shared-types';

@Injectable()
export class TurnService {
  constructor(
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async playAction(
    sessionId: string,
    playerId: string,
    action: CombatAction,
  ): Promise<CombatState> {
    console.log(`[TurnService] playAction: sessionId=${sessionId}, playerId=${playerId}, actionType=${action.type}`);
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);

    if (!state) {
      console.warn(`[TurnService] Session not found for ID: ${sessionId}`);
      throw new BadRequestException('Session de combat introuvable');
    }

    if (state.currentTurnPlayerId !== playerId) {
      console.warn(`[TurnService] Turn mismatch! CurrentTurnPlayer: "${state.currentTurnPlayerId}", RequesterPlayer: "${playerId}"`);
      throw new BadRequestException(`Ce n'est pas votre tour. Actuel: ${state.currentTurnPlayerId}, Vous: ${playerId}`);
    }

    const player = state.players[playerId];
    if (!player) {
      console.warn(`[TurnService] Player "${playerId}" not found in session players:`, Object.keys(state.players));
      throw new BadRequestException(`Joueur introuvable dans la session. ID: ${playerId}`);
    }

    let newState: CombatState;

    switch (action.type) {
      case CombatActionType.MOVE:
        console.log(`[TurnService] Handling MOVE for ${playerId} to ${action.targetX},${action.targetY}`);
        newState = await this.handleMove(state, playerId, action);
        break;

      case CombatActionType.JUMP:
        console.log(`[TurnService] Handling JUMP for ${playerId} to ${action.targetX},${action.targetY}`);
        newState = await this.handleJump(state, playerId, action);
        break;

      case CombatActionType.CAST_SPELL:
        console.log(`[TurnService] Handling CAST_SPELL ${action.spellId} for ${playerId} at ${action.targetX},${action.targetY}`);
        newState = await this.handleCastSpell(state, playerId, action);
        break;

      case CombatActionType.END_TURN:
        console.log(`[TurnService] Handling END_TURN for ${playerId}`);
        newState = await this.handleEndTurn(state, playerId);
        break;

      default:
        throw new BadRequestException('Action invalide');
    }

    // Vérification de victoire / mort
    await this.checkVictory(newState);

    await this.redis.setJson(`combat:${sessionId}`, newState, 3600);
    this.sse.emit(sessionId, 'STATE_UPDATED', newState);

    return newState;
  }

  private async handleMove(
    state: CombatState,
    playerId: string,
    action: CombatAction,
  ): Promise<CombatState> {
    const player = state.players[playerId];
    const target = { x: action.targetX ?? 0, y: action.targetY ?? 0 };

    const occupiedPositions = Object.values(state.players).map(p => p.position);

    if (!canMoveTo(target, player.remainingPm, player.position, state.map.tiles, occupiedPositions)) {
      throw new BadRequestException('Déplacement impossible ou hors de portée');
    }

    const distance = Math.abs(target.x - player.position.x) + Math.abs(target.y - player.position.y);
    player.position = target;
    player.remainingPm -= distance;

    return state;
  }

  private async handleJump(
    state: CombatState,
    playerId: string,
    action: CombatAction,
  ): Promise<CombatState> {
    const player = state.players[playerId];
    const target = { x: action.targetX ?? 0, y: action.targetY ?? 0 };

    const occupiedPositions = Object.values(state.players).map(p => p.position);

    if (!canJumpTo(target, player.remainingPm, player.position, state.map.tiles, occupiedPositions)) {
      throw new BadRequestException('Saut impossible (distance 2 requise, obstacle/eau obligatoire entre les deux)');
    }

    player.position = target;
    player.remainingPm -= 1;

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

    if (player.remainingPa < spell.paCost) {
      throw new BadRequestException('PA insuffisants');
    }

    const cooldown = player.spellCooldowns[spell.id] ?? 0;
    if (cooldown > 0) {
      throw new BadRequestException('Sort en cooldown');
    }

    const targetPos = { x: action.targetX ?? 0, y: action.targetY ?? 0 };

    // Validation portée et LoS (sauf pour certains sorts comme Bond)
    const isSpecialSpell = spell.id === 'spell-bond'; // Bond ignore LoS et obstacles
    
    if (!isInRange(player.position, targetPos, spell.minRange, spell.maxRange)) {
        throw new BadRequestException('Cible hors de portée');
    }

    if (!isSpecialSpell && !hasLineOfSight(player.position, targetPos, state.map.tiles)) {
        throw new BadRequestException('Ligne de vue bloquée');
    }

    // Application des effets
    switch (spell.id) {
        case 'spell-frappe':
            this.applyDamage(state, targetPos, spell, player.stats, false);
            break;
        case 'spell-boule-de-feu':
            this.applyDamage(state, targetPos, spell, player.stats, true);
            break;
        case 'spell-kunai':
            this.applyDamage(state, targetPos, spell, player.stats, false);
            break;
        case 'spell-bond':
            const occupied = Object.values(state.players)
                .some(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
            if (occupied) throw new BadRequestException('Case occupée');
            const tile = state.map.tiles.find(t => t.x === targetPos.x && t.y === targetPos.y);
            if (!tile || tile.type === TerrainType.WATER || !(TERRAIN_PROPERTIES[tile.type as TerrainType]?.traversable ?? false)) {
                throw new BadRequestException('Terrain invalide');
            }
            player.position = targetPos;
            break;
        case 'spell-soin':
            this.applyHeal(state, targetPos, spell, player.stats);
            break;
        case 'spell-endurance':
            // TODO: Ajouter un système de buffs temporaires si nécessaire
            break;
        case 'spell-velocite':
            // TODO: Ajouter un système de buffs temporaires si nécessaire
            break;
    }

    player.remainingPa -= spell.paCost;
    if (spell.cooldown > 0) {
      player.spellCooldowns[spell.id] = spell.cooldown;
    }

    return state;
  }

  private applyDamage(state: CombatState, targetPos: CombatPosition, spell: any, attackerStats: any, isMagical: boolean) {
      const targetPlayer = Object.values(state.players).find(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
      if (!targetPlayer) return;

      const damage = calculateDamage(spell, attackerStats, targetPlayer.stats, isMagical);
      targetPlayer.currentVit = Math.max(0, targetPlayer.currentVit - damage);
      
      this.sse.emit(state.sessionId, 'DAMAGE_DEALT', { 
          targetId: targetPlayer.playerId, 
          damage, 
          remainingVit: targetPlayer.currentVit 
      });
  }

  private applyHeal(state: CombatState, targetPos: CombatPosition, spell: any, attackerStats: any) {
    const targetPlayer = Object.values(state.players).find(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
    if (!targetPlayer) return;

    const heal = calculateHeal(spell, attackerStats);
    targetPlayer.currentVit = Math.min(targetPlayer.stats.vit, targetPlayer.currentVit + heal);
    
    this.sse.emit(state.sessionId, 'STATE_UPDATED', state);
  }

  private async checkVictory(state: CombatState) {
      for (const player of Object.values(state.players)) {
          if (player.currentVit <= 0) {
              const loserId = player.playerId;
              const winner = Object.values(state.players).find(p => p.playerId !== loserId);
              const winnerId = winner?.playerId;

              this.sse.emit(state.sessionId, 'COMBAT_ENDED', { winnerId, loserId });
              
              // Notifier l'équipe A
              this.eventEmitter.emit(GAME_EVENTS.COMBAT_ENDED, {
                  sessionId: state.sessionId,
                  winnerId,
                  loserId
              });

              // Cleanup
              await this.redis.del(`combat:${state.sessionId}`);
              this.sse.removeStream(state.sessionId);
          }
      }
  }

  private async handleEndTurn(
    state: CombatState,
    playerId: string,
  ): Promise<CombatState> {
    const playerIds = Object.keys(state.players);
    const currentIndex = playerIds.indexOf(playerId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    const nextPlayerId = playerIds[nextIndex];

    state.currentTurnPlayerId = nextPlayerId;
    state.turnNumber += 1;

    const nextPlayer = state.players[nextPlayerId];
    
    // Réinitialiser PA/PM
    nextPlayer.remainingPa = nextPlayer.stats.pa;
    nextPlayer.remainingPm = nextPlayer.stats.pm;

    // Décrémenter les cooldowns
    for (const spellId of Object.keys(nextPlayer.spellCooldowns)) {
      nextPlayer.spellCooldowns[spellId] = Math.max(0, nextPlayer.spellCooldowns[spellId] - 1);
    }

    this.sse.emit(state.sessionId, 'TURN_STARTED', { playerId: nextPlayerId });

    return state;
  }

  /**
   * Version de playAction qui ignore la vérification d'identité (DEBUG UNIQUEMENT).
   */
  async forcePlayAction(
    sessionId: string,
    asPlayerId: string,
    action: CombatAction,
  ): Promise<CombatState> {
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);
    if (!state) throw new BadRequestException('Session introuvable');

    if (state.currentTurnPlayerId !== asPlayerId) {
      throw new BadRequestException('Ce n\'est pas le tour de ce joueur');
    }

    const player = state.players[asPlayerId];
    if (!player) throw new BadRequestException('Joueur introuvable');

    let newState: CombatState;
    switch (action.type) {
      case CombatActionType.MOVE: newState = await this.handleMove(state, asPlayerId, action); break;
      case CombatActionType.JUMP: newState = await this.handleJump(state, asPlayerId, action); break;
      case CombatActionType.CAST_SPELL: newState = await this.handleCastSpell(state, asPlayerId, action); break;
      case CombatActionType.END_TURN: newState = await this.handleEndTurn(state, asPlayerId); break;
      default: throw new BadRequestException('Action invalide');
    }

    await this.checkVictory(newState);
    await this.redis.setJson(`combat:${sessionId}`, newState, 3600);
    this.sse.emit(sessionId, 'STATE_UPDATED', newState);

    return newState;
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import type { CombatState, CombatAction, CombatPosition } from '@game/shared-types';
import { CombatActionType } from '@game/shared-types';
import { canMoveTo, canJumpTo, isInRange, hasLineOfSight } from '@game/game-engine';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GAME_EVENTS } from '@game/shared-types';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { RuntimePerfService } from '../../shared/perf/runtime-perf.service';
import { SpellsService } from '../spells/spells.service';

@Injectable()
export class TurnService {
  private readonly sessionLocks = new Set<string>();

  constructor(
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly spells: SpellsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly perfLogger: PerfLoggerService,
    private readonly runtimePerf: RuntimePerfService,
  ) {}

  async playAction(
    sessionId: string,
    playerId: string,
    action: CombatAction,
  ): Promise<CombatState> {
    if (this.sessionLocks.has(sessionId)) {
      this.perfLogger.logEvent('combat', 'turn.session.locked', {
        session_id: sessionId,
        player_id: playerId,
        action_type: action.type,
      }, { level: 'warn' });
      throw new BadRequestException('Une action est déjà en cours de traitement');
    }
    this.sessionLocks.add(sessionId);
    const startedAt = performance.now();
    const sseEventsBefore = this.runtimePerf.getTotalSseEvents();

    try {
      const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);

      if (!state) {
        this.perfLogger.logEvent('combat', 'turn.session.miss', {
          session_id: sessionId,
          action_type: action.type,
        }, { level: 'warn' });
        throw new BadRequestException('Session de combat introuvable');
      }

      // On autorise l'abandon (SURRENDER) même si ce n'est pas notre tour
      if (action.type !== CombatActionType.SURRENDER && state.currentTurnPlayerId !== playerId) {
        this.perfLogger.logEvent('combat', 'turn.player.mismatch', {
          session_id: sessionId,
          player_id: playerId,
          current_turn_player_id: state.currentTurnPlayerId,
          action_type: action.type,
        }, { level: 'warn' });
        throw new BadRequestException(`Ce n'est pas votre tour. Actuel: ${state.currentTurnPlayerId}, Vous: ${playerId}`);
      }

      const player = state.players[playerId];
      if (!player) {
        this.perfLogger.logEvent('combat', 'turn.player.missing', {
          session_id: sessionId,
          player_id: playerId,
          action_type: action.type,
        }, { level: 'warn' });
        throw new BadRequestException(`Joueur introuvable dans la session. ID: ${playerId}`);
      }

      let newState: CombatState;

      switch (action.type) {
        case CombatActionType.MOVE:
          newState = await this.handleMove(state, playerId, action);
          break;

        case CombatActionType.JUMP:
          newState = await this.handleJump(state, playerId, action);
          break;

        case CombatActionType.CAST_SPELL:
          newState = await this.handleCastSpell(state, playerId, action);
          break;

        case CombatActionType.END_TURN:
          newState = await this.handleEndTurn(state, playerId);
          break;

        case CombatActionType.SURRENDER:
          newState = await this.handleSurrender(state, playerId);
          break;

        default:
          throw new BadRequestException('Action invalide');
      }

      // Vérification de victoire / mort
      await this.checkVictory(newState);

      await this.redis.setJson(`combat:${sessionId}`, newState, 3600);
      this.sse.emit(sessionId, 'STATE_UPDATED', newState);
      const sseEventsEmitted = this.runtimePerf.getTotalSseEvents() - sseEventsBefore;

      this.perfLogger.logDuration('combat', 'turn.play_action', performance.now() - startedAt, {
        session_id: sessionId,
        player_id: playerId,
        action_type: action.type,
        sse_events_emitted: sseEventsEmitted,
      });
      this.perfLogger.logMetric(
        'combat',
        'action.sse_events',
        sseEventsEmitted,
        {
          session_id: sessionId,
          player_id: playerId,
          action_type: action.type,
        },
        { decimals: 0, force: true },
      );

      return newState;
    } catch (error) {
      this.perfLogger.logEvent('combat', 'turn.play_action.error', {
        session_id: sessionId,
        player_id: playerId,
        action_type: action.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { level: 'warn' });
      throw error;
    } finally {
      this.sessionLocks.delete(sessionId);
    }
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

    const from = { ...player.position };
    player.position = target;
    player.remainingPm -= 1;

    this.sse.emit(state.sessionId, 'PLAYER_JUMPED', {
        playerId: player.playerId,
        from,
        to: target
    });

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

    if (player.spellCooldowns[spell.id] > 0) {
      throw new BadRequestException('Sort encore en cooldown');
    }

    const targetPos = { x: action.targetX ?? 0, y: action.targetY ?? 0 };

    if (!isInRange(player.position, targetPos, spell.minRange, spell.maxRange)) {
        throw new BadRequestException('Cible hors de portée');
    }

    if (spell.requiresLineOfSight && !hasLineOfSight(player.position, targetPos, state.map.tiles)) {
        throw new BadRequestException('Ligne de vue bloquée');
    }

    if (spell.requiresLinearTargeting && player.position.x !== targetPos.x && player.position.y !== targetPos.y) {
        throw new BadRequestException('Lancer en ligne uniquement');
    }

    const executionResult = this.spells.executeEffect(state, spell, player, targetPos);
    executionResult.events.forEach((event) => {
      this.sse.emit(state.sessionId, event.type, event.payload);
    });

    player.remainingPa -= spell.paCost;
    if (spell.cooldown > 0) {
        player.spellCooldowns[spell.id] = spell.cooldown;
    }

    // Émettre l'événement de sort pour l'animation
    this.sse.emit(state.sessionId, 'SPELL_CAST', {
        casterId: playerId,
        spellId: spell.id,
        visualType: spell.visualType, // On passe l'info visuelle !
        targetX: action.targetX,
        targetY: action.targetY
    });

    return state;
  }

  private async handleSurrender(state: CombatState, playerId: string): Promise<CombatState> {
    const player = state.players[playerId];
    if (player) {
      player.currentVit = 0;
    }
    return state;
  }

  private async checkVictory(state: CombatState) {
      const players = Object.values(state.players).filter(p => p.type === 'PLAYER');
      for (const player of players) {
          if (player.currentVit <= 0) {
              const loserId = player.playerId;
              const winner = players.find(p => p.playerId !== loserId);
              const winnerId = winner?.playerId;

              state.winnerId = winnerId; // Marquer l'état comme fini pour le front

              this.sse.emit(state.sessionId, 'COMBAT_ENDED', { winnerId, loserId });
              
              this.eventEmitter.emit(GAME_EVENTS.COMBAT_PLAYER_DIED, {
                  sessionId: state.sessionId,
                  playerId: loserId,
              });
              
              // Notifier l'équipe A (Prisma, etc.)
              this.eventEmitter.emit(GAME_EVENTS.COMBAT_ENDED, {
                  sessionId: state.sessionId,
                  winnerId,
                  loserId
              });

              // On NE SUPPRIME PLUS du redis immédiatement pour laisser le front lire le winnerId
              // Le TTL de 3600s fera le nettoyage tout seul
              return true;
          }
      }
      return false;
  }

  private async handleEndTurn(
    state: CombatState,
    playerId: string,
  ): Promise<CombatState> {
    const playerIds = Object.values(state.players)
        .filter(p => p.type === 'PLAYER')
        .map(p => p.playerId);

    const currentIndex = playerIds.indexOf(playerId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    const nextPlayerId = playerIds[nextIndex];

    const currentPlayer = state.players[playerId];
    
    // Décrémenter les buffs du joueur qui finit son tour
    currentPlayer.buffs.forEach(b => b.remainingTurns--);
    currentPlayer.buffs = currentPlayer.buffs.filter(b => b.remainingTurns > 0);

    state.currentTurnPlayerId = nextPlayerId;
    state.turnNumber += 1;

    const nextPlayer = state.players[nextPlayerId];
    
    // Calculer les bonus de buffs pour le début du tour
    const paBonus = nextPlayer.buffs.filter(b => b.type === 'PA').reduce((sum, b) => sum + b.value, 0);
    const pmBonus = nextPlayer.buffs.filter(b => b.type === 'PM').reduce((sum, b) => sum + b.value, 0);

    // Réinitialiser PA/PM + Bonus
    nextPlayer.remainingPa = nextPlayer.stats.pa + paBonus;
    nextPlayer.remainingPm = nextPlayer.stats.pm + pmBonus;

    // Décrémenter les cooldowns
    for (const spellId of Object.keys(nextPlayer.spellCooldowns)) {
      nextPlayer.spellCooldowns[spellId] = Math.max(0, nextPlayer.spellCooldowns[spellId] - 1);
    }

    this.sse.emit(state.sessionId, 'TURN_STARTED', { playerId: nextPlayerId });
    this.eventEmitter.emit(GAME_EVENTS.TURN_STARTED, { sessionId: state.sessionId, playerId: nextPlayerId });

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
    const startedAt = performance.now();
    const sseEventsBefore = this.runtimePerf.getTotalSseEvents();
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
    const sseEventsEmitted = this.runtimePerf.getTotalSseEvents() - sseEventsBefore;

    this.perfLogger.logDuration('combat', 'turn.force_play_action', performance.now() - startedAt, {
      session_id: sessionId,
      player_id: asPlayerId,
      action_type: action.type,
      sse_events_emitted: sseEventsEmitted,
    });
    this.perfLogger.logMetric(
      'combat',
      'action.sse_events',
      sseEventsEmitted,
      {
        session_id: sessionId,
        player_id: asPlayerId,
        action_type: action.type,
        forced: true,
      },
      { decimals: 0, force: true },
    );

    return newState;
  }
}

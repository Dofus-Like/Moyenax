import { Injectable, BadRequestException } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import type { CombatState, CombatAction, CombatPosition } from '@game/shared-types';
import { CombatActionType, TerrainType, TERRAIN_PROPERTIES } from '@game/shared-types';
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
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';

@Injectable()
export class TurnService {
  private readonly sessionLocks = new Set<string>();

  constructor(
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly perfLogger: PerfLoggerService,
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

      this.perfLogger.logDuration('combat', 'turn.play_action', performance.now() - startedAt, {
        session_id: sessionId,
        player_id: playerId,
        action_type: action.type,
      });

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
        case 'spell-bond': {
            const occupied = Object.values(state.players)
                .some(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
            if (occupied) throw new BadRequestException('Case occupée');
            const tile = state.map.tiles.find(t => t.x === targetPos.x && t.y === targetPos.y);
            if (!tile || !(TERRAIN_PROPERTIES[tile.type as TerrainType]?.traversable ?? false)) {
                throw new BadRequestException('Terrain invalide');
            }
            const from = { ...player.position };
            player.position = targetPos;
            this.sse.emit(state.sessionId, 'PLAYER_JUMPED', {
                playerId: player.playerId,
                from,
                to: targetPos
            });
            break;
        }
        case 'spell-soin':
            this.applyHeal(state, targetPos, spell, player.stats);
            break;
        case 'spell-endurance': {
            player.stats.vit += 20;
            player.currentVit += 20;
            // On peut ajouter un buff visuel de 99 tours pour le front
            player.buffs.push({ type: 'VIT_MAX', value: 20, remainingTurns: 99 });
            break;
        }
        case 'spell-menhir': {
            const occupied = Object.values(state.players).some(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
            if (occupied) throw new BadRequestException('Case occupée');
            
            const summonId = `summon-menhir-${Date.now()}`;
            state.players[summonId] = {
                playerId: summonId,
                username: 'Menhir',
                type: 'SUMMON',
                stats: { 
                    vit: 1, atk: 0, mag: 0, def: 0, res: 0, ini: 0, pa: 0, pm: 0,
                    baseVit: 1, baseAtk: 0, baseMag: 0, baseDef: 0, baseRes: 0, baseIni: 0, basePa: 0, basePm: 0
                },
                currentVit: 1,
                position: { ...targetPos },
                spells: [],
                remainingPa: 0,
                remainingPm: 0,
                spellCooldowns: {},
                buffs: [],
                skin: 'menhir'
            };
            break;
        }
        case 'spell-bombe-repousse': {
            // Check line cast
            const dx = Math.abs(targetPos.x - player.position.x);
            const dy = Math.abs(targetPos.y - player.position.y);
            if (dx > 0 && dy > 0) throw new BadRequestException('Lancer en ligne uniquement');

            this.applyPush(state, player.position, targetPos, 3);
            break;
        }
        case 'spell-velocite':
            player.buffs.push({ type: 'PM', value: 2, remainingTurns: 1 });
            player.remainingPm += 2; // Effet immédiat
            break;
    }

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

  private applyPush(state: CombatState, casterPos: CombatPosition, targetPos: CombatPosition, distance: number) {
      const targetPlayer = Object.values(state.players).find(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
      if (!targetPlayer) return;

      const dx = Math.sign(targetPos.x - casterPos.x);
      const dy = Math.sign(targetPos.y - casterPos.y);

      let finalPos = { ...targetPlayer.position };
      for (let i = 0; i < distance; i++) {
          const next = { x: finalPos.x + dx, y: finalPos.y + dy };
          
          // Check bounds
          if (next.x < 0 || next.x >= state.map.width || next.y < 0 || next.y >= state.map.height) break;
          
          // Check obstacles
          const tile = state.map.tiles.find(t => t.x === next.x && t.y === next.y);
          if (!tile || !(TERRAIN_PROPERTIES[tile.type as TerrainType]?.traversable ?? false)) break;
          
          // Check occupied
          if (Object.values(state.players).some(p => p.position.x === next.x && p.position.y === next.y)) break;

          finalPos = next;
      }

      if (finalPos.x !== targetPlayer.position.x || finalPos.y !== targetPlayer.position.y) {
          targetPlayer.position = finalPos;
          this.sse.emit(state.sessionId, 'STATE_UPDATED', state);
      }
  }

  private applyDamage(state: CombatState, targetPos: CombatPosition, spell: any, attackerStats: any, isMagical: boolean) {
      const targetPlayer = Object.values(state.players).find(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
      if (!targetPlayer) return;

      // Calcul de la défense réelle avec buffs
      const defBuffs = targetPlayer.buffs.filter(b => b.type === 'DEF').reduce((sum, b) => sum + b.value, 0);
      const resBuffs = targetPlayer.buffs.filter(b => b.type === 'RES').reduce((sum, b) => sum + b.value, 0);
      
      const effectiveStats = {
          ...targetPlayer.stats,
          def: targetPlayer.stats.def + defBuffs,
          res: targetPlayer.stats.res + resBuffs
      };

      const damage = calculateDamage(spell, attackerStats, effectiveStats, isMagical);
      targetPlayer.currentVit = Math.max(0, targetPlayer.currentVit - damage);
      
      this.sse.emit(state.sessionId, 'DAMAGE_DEALT', { 
          targetId: targetPlayer.playerId, 
          damage, 
          remainingVit: targetPlayer.currentVit 
      });

      // Supprimer les invocations mortes
      if (targetPlayer.type === 'SUMMON' && targetPlayer.currentVit <= 0) {
          delete state.players[targetPlayer.playerId];
      }
  }

  private applyHeal(state: CombatState, targetPos: CombatPosition, spell: any, attackerStats: any) {
    const targetPlayer = Object.values(state.players).find(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
    if (!targetPlayer) return;

    const heal = calculateHeal(spell, attackerStats);
    targetPlayer.currentVit = Math.min(targetPlayer.stats.vit, targetPlayer.currentVit + heal);
    
    this.sse.emit(state.sessionId, 'HEAL_DEALT', {
        targetId: targetPlayer.playerId,
        heal,
        remainingVit: targetPlayer.currentVit
    });

    this.sse.emit(state.sessionId, 'STATE_UPDATED', state);
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

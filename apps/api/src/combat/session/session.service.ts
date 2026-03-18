import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { CombatState, CombatPlayer, Tile } from '@game/shared-types';
import { PlayerStatsService } from '../../player/player-stats.service';
import { MapService } from '../map/map.service';
import { calculateInitiativeJet, calculatePlayerSpells } from '@game/game-engine';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly playerStatsService: PlayerStatsService,
    private readonly mapService: MapService,
  ) {}

  async challenge(challengerId: string, targetId: string) {
    if (challengerId === targetId) {
      throw new BadRequestException('Impossible de se défier soi-même');
    }

    const target = await this.prisma.player.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException('Joueur cible introuvable');
    }

    const session = await this.prisma.combatSession.create({
      data: {
        player1Id: challengerId,
        player2Id: targetId,
        status: 'WAITING',
      },
    });

    return session;
  }

  async accept(sessionId: string) {
    const session = await this.prisma.combatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    if (session.status !== 'WAITING') {
      throw new BadRequestException('Cette session ne peut plus être acceptée');
    }

    // Récupérer les stats effectives des joueurs
    const statsP1 = await this.playerStatsService.getEffectiveStats(session.player1Id);
    const statsP2 = await this.playerStatsService.getEffectiveStats(session.player2Id);

    // Déterminer l'initiative
    const init1 = calculateInitiativeJet(statsP1);
    const init2 = calculateInitiativeJet(statsP2);
    const firstPlayerId = init1 >= init2 ? session.player1Id : session.player2Id;

    // Récupérer les items équipés et calculer les spells
    const itemsP1 = await this.playerStatsService.getEquippedItems(session.player1Id);
    const itemsP2 = await this.playerStatsService.getEquippedItems(session.player2Id);
    
    const spellsP1 = calculatePlayerSpells(itemsP1);
    const spellsP2 = calculatePlayerSpells(itemsP2);

    console.log(`[SessionService] Items P1(${session.player1Id}):`, itemsP1.map(i => i.name));
    console.log(`[SessionService] Items P2(${session.player2Id}):`, itemsP2.map(i => i.name));
    console.log(`[SessionService] Spells P1:`, spellsP1.map(s => s.name));
    console.log(`[SessionService] Spells P2:`, spellsP2.map(s => s.name));

    // Générer la carte (snapshot)
    const tiles = this.mapService.generateCombatMap();

    const initialState: CombatState = {
      sessionId,
      currentTurnPlayerId: firstPlayerId,
      turnNumber: 1,
      players: {
        [session.player1Id]: {
          playerId: session.player1Id,
          stats: statsP1,
          currentVit: statsP1.vit,
          position: { x: 1, y: 1 },
          spells: spellsP1,
          remainingPa: statsP1.pa,
          remainingPm: statsP1.pm,
          spellCooldowns: {},
        },
        [session.player2Id]: {
          playerId: session.player2Id,
          stats: statsP2,
          currentVit: statsP2.vit,
          position: { x: 18, y: 18 },
          spells: spellsP2,
          remainingPa: statsP2.pa,
          remainingPm: statsP2.pm,
          spellCooldowns: {},
        },
      },
      map: {
        width: 20,
        height: 20,
        tiles,
      },
    };

    await this.prisma.combatSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE' },
    });

    await this.redis.setJson(`combat:${sessionId}`, initialState, 3600);

    // Émettre les événements SSE
    this.sse.emit(sessionId, 'STATE_UPDATED', initialState);
    this.sse.emit(sessionId, 'TURN_STARTED', { playerId: firstPlayerId });

    return initialState;
  }

  async getState(sessionId: string): Promise<CombatState> {
    console.log(`[SessionService] GET State for session: ${sessionId}`);
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);
    
    if (!state) {
      console.warn(`[SessionService] State NOT FOUND in Redis for session: ${sessionId}`);
      throw new NotFoundException('État de combat introuvable');
    }
    
    console.log(`[SessionService] State found for session ${sessionId}. Players: ${Object.keys(state.players).join(', ')}`);
    return state;
  }

  async startTestCombat(challengerId: string) {
    // Trouver un adversaire (Mage par défaut ou n'importe qui d'autre)
    let target = await this.prisma.player.findFirst({
      where: {
        id: { not: challengerId },
        username: 'Mage'
      }
    });

    if (!target) {
      target = await this.prisma.player.findFirst({
        where: { id: { not: challengerId } }
      });
    }

    if (!target) {
      throw new BadRequestException('Aucun autre joueur trouvé pour le test. Lancez le seed !');
    }

    const session = await this.prisma.combatSession.create({
      data: {
        player1Id: challengerId,
        player2Id: target.id,
        status: 'WAITING',
      },
    });

    // Accepter automatiquement pour le test
    return this.accept(session.id);
  }

  async getHistory(playerId: string) {
    return this.prisma.combatSession.findMany({
      where: {
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
        status: 'FINISHED',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}

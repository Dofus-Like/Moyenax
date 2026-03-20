import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { CombatState } from '@game/shared-types';
import { PlayerStatsService } from '../../player/player-stats.service';
import { MapService } from '../map/map.service';
import { calculateInitiativeJet, calculatePlayerSpells } from '@game/game-engine';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GAME_EVENTS } from '@game/shared-types';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly playerStatsService: PlayerStatsService,
    private readonly mapService: MapService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Utilisé par GameSession (VS AI dans le tunnel). */
  async getOrCreateBotPlayer() {
    return this.getOrCreateBot();
  }

  private async getOrCreateBot() {
    let bot = await this.prisma.player.findUnique({
      where: { username: 'Bot' },
    });

    if (!bot) {
      bot = await this.prisma.player.create({
        data: {
          username: 'Bot',
          email: 'bot@game.internal',
          passwordHash: 'bot-password-never-log-in',
          stats: {
            create: {
              vit: 100,
              pa: 6,
              pm: 3,
              atk: 5,
              def: 5,
              mag: 0,
              res: 5,
            },
          },
        },
      });
      
      // Lui donner un sort de base
      const punch = await this.prisma.spell.findFirst({ where: { name: 'Frappe' } });
      if (punch) {
        await this.prisma.playerSpell.create({
          data: { playerId: bot.id, spellId: punch.id },
        });
      }
    }

    return bot;
  }

  async challenge(challengerId: string, targetId?: string) {
    if (targetId && challengerId === targetId) {
      throw new BadRequestException('Impossible de se défier soi-même');
    }

    const data: any = {
      player1Id: challengerId,
      status: 'WAITING',
    };
    
    if (targetId) {
      data.player2Id = targetId;
    }

    const session = await this.prisma.combatSession.create({ data });

    return session;
  }

  async getRooms() {
    return this.prisma.combatSession.findMany({
        where: { 
            status: 'WAITING',
            player2Id: null
        } as any,
        include: {
            player1: {
                select: { username: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
  }

  async accept(sessionId: string, player2Id?: string) {
    let session = await this.prisma.combatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    if (session.status !== 'WAITING') {
      throw new BadRequestException('Cette session ne peut plus être acceptée');
    }

    // Si la session n'a pas de player2, le joueur qui accepte devient le player2
    if (!session.player2Id) {
        if (!player2Id) throw new BadRequestException('ID du joueur 2 manquant');
        if (session.player1Id === player2Id) throw new BadRequestException('Impossible de rejoindre sa propre room');
        
        session = await this.prisma.combatSession.update({
            where: { id: sessionId },
            data: { player2Id }
        });
    }

    // Sécurité: vérifier que player2Id est maintenant bien présent
    if (!session.player2Id) throw new Error('Échec de liaison du joueur 2');

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

    // Récupérer les données de profil (pour le username et le skin)
    const p1 = await this.prisma.player.findUnique({ where: { id: session.player1Id } });
    const p2 = await this.prisma.player.findUnique({ where: { id: session.player2Id } });

    const initialState: CombatState = {
      sessionId,
      currentTurnPlayerId: firstPlayerId,
      turnNumber: 1,
      players: {
        [session.player1Id]: {
          playerId: session.player1Id,
          username: p1?.username || 'Joueur 1',
          type: 'PLAYER',
          stats: statsP1,
          currentVit: statsP1.vit,
          position: { x: 1, y: 1 },
          spells: spellsP1,
          remainingPa: statsP1.pa,
          remainingPm: statsP1.pm,
          spellCooldowns: {},
          buffs: [],
          skin: p1?.skin || 'soldier-classic',
        },
        [session.player2Id]: {
          playerId: session.player2Id,
          username: p2?.username || 'Joueur 2',
          type: 'PLAYER',
          stats: statsP2,
          currentVit: statsP2.vit,
          position: { x: 8, y: 8 },
          spells: spellsP2,
          remainingPa: statsP2.pa,
          remainingPm: statsP2.pm,
          spellCooldowns: {},
          buffs: [],
          skin: p2?.skin || 'soldier-classic',
        },
      },
      map: {
        width: 10,
        height: 10,
        tiles: this.mapService.generateCombatMap(10, 10),
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
    this.eventEmitter.emit(GAME_EVENTS.TURN_STARTED, { sessionId, playerId: firstPlayerId });

    return initialState;
  }

  async endCombat(sessionId: string, winnerId: string) {
    const session = await this.prisma.combatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status === 'FINISHED') return;

    await this.prisma.$transaction([
      this.prisma.combatSession.update({
        where: { id: sessionId },
        data: { status: 'FINISHED', winnerId, endedAt: new Date() },
      }),
      this.prisma.player.update({
        where: { id: winnerId },
        data: { gold: { increment: 50 } }, // Reward fixed à 50 Or
      }),
    ]);

    await this.redis.del(`combat:${sessionId}`);
    this.sse.emit(sessionId, 'COMBAT_ENDED', { winnerId, reward: 50 });
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

    const activeSession = await this.prisma.gameSession.findFirst({
      where: {
        OR: [{ player1Id: challengerId }, { player2Id: challengerId }],
        status: 'ACTIVE',
      },
    });

    const session = await this.prisma.combatSession.create({
      data: {
        player1Id: challengerId,
        player2Id: target.id,
        status: 'WAITING',
        gameSessionId: activeSession?.id,
      },
    });

    // Accepter automatiquement pour le test
    return this.accept(session.id);
  }

  async startVsAiCombat(challengerId: string) {
    const bot = await this.getOrCreateBot();

    const activeSession = await this.prisma.gameSession.findFirst({
      where: {
        OR: [{ player1Id: challengerId }, { player2Id: challengerId }],
        status: 'ACTIVE',
      },
    });

    const session = await this.prisma.combatSession.create({
      data: {
        player1Id: challengerId,
        player2Id: bot.id,
        status: 'WAITING',
        gameSessionId: activeSession?.id,
      },
    });

    // Accepter automatiquement
    return this.accept(session.id);
  }

  async startSessionCombat(player1Id: string, player2Id: string, gameSessionId: string) {
    const session = await this.prisma.combatSession.create({
      data: {
        player1Id,
        player2Id,
        status: 'WAITING',
        gameSessionId,
      },
    });

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

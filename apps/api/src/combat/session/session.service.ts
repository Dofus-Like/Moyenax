import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { calculateInitiativeJet } from '@game/game-engine';
import { GAME_EVENTS } from '@game/shared-types';
import type { CombatState } from '@game/shared-types';
import { performance } from 'node:perf_hooks';
import { PlayerSpellProjectionService } from '../../player/player-spell-projection.service';
import { PlayerStatsService } from '../../player/player-stats.service';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SessionSecurityService } from '../../shared/security/session-security.service';
import { SseTicketService } from '../../shared/security/sse-ticket.service';
import { SseService } from '../../shared/sse/sse.service';
import { MapService } from '../map/map.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly playerSpellProjection: PlayerSpellProjectionService,
    private readonly playerStatsService: PlayerStatsService,
    private readonly mapService: MapService,
    private readonly eventEmitter: EventEmitter2,
    private readonly perfLogger: PerfLoggerService,
    private readonly sessionSecurity: SessionSecurityService,
    private readonly sseTickets: SseTicketService,
  ) {}

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
    }

    return bot;
  }

  async challenge(challengerId: string, targetId?: string) {
    if (targetId && challengerId === targetId) {
      throw new BadRequestException('Impossible de se defier soi-meme');
    }

    await this.sessionSecurity.assertPlayerAvailableForPublicRoom(challengerId);

    if (targetId) {
      await this.sessionSecurity.assertPlayerAvailableForPublicRoom(targetId);
    }

    const data: any = {
      player1Id: challengerId,
      status: 'WAITING',
    };

    if (targetId) {
      data.player2Id = targetId;
    }

    return this.prisma.combatSession.create({ data });
  }

  async getRooms() {
    return this.prisma.combatSession.findMany({
      where: {
        status: 'WAITING',
        player2Id: null,
        gameSessionId: null,
      } as any,
      include: {
        player1: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(sessionId: string, player2Id: string) {
    const startedAt = performance.now();
    const requestedSession = await this.sessionSecurity.assertCanAcceptCombatSession(sessionId, player2Id);

    if (!requestedSession.player2Id) {
      const linked = await this.prisma.combatSession.updateMany({
        where: {
          id: sessionId,
          status: 'WAITING',
          player2Id: null,
        },
        data: { player2Id },
      });

      if (linked.count !== 1) {
        throw new BadRequestException('Cette session ne peut plus etre acceptee');
      }
    }

    const activated = await this.prisma.combatSession.updateMany({
      where: {
        id: sessionId,
        status: 'WAITING',
        player2Id,
      },
      data: { status: 'ACTIVE' },
    });

    if (activated.count !== 1) {
      throw new BadRequestException('Cette session ne peut plus etre acceptee');
    }

    const session = await this.prisma.combatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session?.player2Id) {
      throw new BadRequestException('Echec de liaison du joueur 2');
    }

    await Promise.all([
      this.playerSpellProjection.syncPlayerSpells(session.player1Id),
      this.playerSpellProjection.syncPlayerSpells(session.player2Id),
    ]);

    const [loadoutP1, loadoutP2, spellsP1, spellsP2, p1, p2] = await Promise.all([
      this.playerStatsService.getCombatLoadout(session.player1Id),
      this.playerStatsService.getCombatLoadout(session.player2Id),
      this.playerSpellProjection.getCombatSpellDefinitions(session.player1Id),
      this.playerSpellProjection.getCombatSpellDefinitions(session.player2Id),
      this.prisma.player.findUnique({
        where: { id: session.player1Id },
        select: { username: true, skin: true },
      }),
      this.prisma.player.findUnique({
        where: { id: session.player2Id },
        select: { username: true, skin: true },
      }),
    ]);

    const statsP1 = loadoutP1.stats;
    const statsP2 = loadoutP2.stats;

    const init1 = calculateInitiativeJet(statsP1);
    const init2 = calculateInitiativeJet(statsP2);
    const firstPlayerId = init1 >= init2 ? session.player1Id : session.player2Id;

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
          items: loadoutP1.items,
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
          items: loadoutP2.items,
        },
      },
      map: {
        width: 10,
        height: 10,
        tiles: this.mapService.generateCombatMap(10, 10),
      },
    };

    await this.redis.setJson(`combat:${sessionId}`, initialState, 3600);

    this.sse.emit(sessionId, 'STATE_UPDATED', initialState);
    this.sse.emit(sessionId, 'TURN_STARTED', { playerId: firstPlayerId });
    this.eventEmitter.emit(GAME_EVENTS.TURN_STARTED, { sessionId, playerId: firstPlayerId });

    this.perfLogger.logDuration('combat', 'session.accept', performance.now() - startedAt, {
      session_id: sessionId,
      player_1_id: session.player1Id,
      player_2_id: session.player2Id,
    });

    return initialState;
  }

  async endCombat(combatSessionId: string, winnerId: string, loserId: string) {
    const session = await this.prisma.combatSession.findUnique({
      where: { id: combatSessionId },
    });

    if (!session || session.status === 'FINISHED') return;

    const gameSessionId = session.gameSessionId;

    if (gameSessionId) {
      const gs = await (this.prisma as any).gameSession.findUnique({
        where: { id: gameSessionId },
      });

      if (!gs) {
        await this.redis.del(`combat:${combatSessionId}`);
        return;
      }

      const winnerIsP1 = winnerId === gs.player1Id;
      const poData = winnerIsP1
        ? { player1Po: { increment: 50 }, player2Po: { increment: 25 } }
        : { player2Po: { increment: 50 }, player1Po: { increment: 25 } };

      await this.prisma.$transaction([
        this.prisma.combatSession.update({
          where: { id: combatSessionId },
          data: { status: 'FINISHED', winnerId, endedAt: new Date() },
        }),
        (this.prisma as any).gameSession.update({
          where: { id: gameSessionId },
          data: poData,
        }),
      ]);

      const updated = await (this.prisma as any).gameSession.findUnique({
        where: { id: gameSessionId },
        include: {
          p1: { select: { username: true } },
          p2: { select: { username: true } },
          combats: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });
      if (updated) {
        this.sse.emit(`game-session:${gameSessionId}`, 'SESSION_UPDATED', updated);
      }
    } else {
      await this.prisma.$transaction([
        this.prisma.combatSession.update({
          where: { id: combatSessionId },
          data: { status: 'FINISHED', winnerId, endedAt: new Date() },
        }),
        this.prisma.player.update({
          where: { id: winnerId },
          data: { gold: { increment: 50 } },
        }),
        this.prisma.player.update({
          where: { id: loserId },
          data: { gold: { increment: 25 } },
        }),
      ]);
    }

    await this.redis.del(`combat:${combatSessionId}`);
    this.sse.emit(combatSessionId, 'COMBAT_ENDED', {
      winnerId,
      loserId,
      winnerRewardPo: 50,
      loserRewardPo: 25,
    });
  }

  async getState(sessionId: string): Promise<CombatState> {
    const startedAt = performance.now();
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);

    if (!state) {
      this.perfLogger.logEvent(
        'combat',
        'session.state.miss',
        {
          session_id: sessionId,
        },
        { level: 'warn' },
      );
      throw new NotFoundException('Etat de combat introuvable');
    }

    this.perfLogger.logDuration('combat', 'session.get_state', performance.now() - startedAt, {
      session_id: sessionId,
      player_count: Object.keys(state.players).length,
    });

    return state;
  }

  async getStateForParticipant(sessionId: string, userId: string) {
    await this.sessionSecurity.getCombatSessionForParticipantOrThrow(sessionId, userId);
    return this.getState(sessionId);
  }

  async issueStreamTicket(sessionId: string, userId: string) {
    await this.sessionSecurity.getCombatSessionForParticipantOrThrow(sessionId, userId);
    return this.sseTickets.issueTicket({
      userId,
      resourceId: sessionId,
      resourceType: 'combat',
    });
  }

  async startTestCombat(challengerId: string) {
    let target = await this.prisma.player.findFirst({
      where: {
        id: { not: challengerId },
        username: 'Mage',
      },
    });

    if (!target) {
      target = await this.prisma.player.findFirst({
        where: { id: { not: challengerId } },
      });
    }

    if (!target) {
      throw new BadRequestException('Aucun autre joueur trouve pour le test. Lancez le seed !');
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

    return this.accept(session.id, target.id);
  }

  async startVsAiCombat(challengerId: string) {
    const bot = await this.getOrCreateBot();
    const activeSession = await this.prisma.gameSession.findFirst({
      where: {
        OR: [{ player1Id: challengerId }, { player2Id: challengerId }],
        status: 'ACTIVE',
      },
    });

    if (!activeSession) {
      await this.sessionSecurity.assertPlayerAvailableForPublicRoom(challengerId);
    }

    const session = await this.prisma.combatSession.create({
      data: {
        player1Id: challengerId,
        player2Id: bot.id,
        status: 'WAITING',
        gameSessionId: activeSession?.id,
      },
    });

    return this.accept(session.id, bot.id);
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

    return this.accept(session.id, player2Id);
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

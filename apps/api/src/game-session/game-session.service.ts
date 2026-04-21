import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { OnEvent as NestOnEvent } from '@nestjs/event-emitter';
import { GAME_EVENTS } from '@game/shared-types';
import { SessionService } from '../combat/session/session.service';
import { PlayerSpellProjectionService } from '../player/player-spell-projection.service';
import { StatsCalculatorService } from '../player/stats-calculator.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { RedisService } from '../shared/redis/redis.service';
import { SessionSecurityService } from '../shared/security/session-security.service';
import { SseTicketService } from '../shared/security/sse-ticket.service';
import { SseService } from '../shared/sse/sse.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class GameSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly sessionService: SessionService,
    private readonly sessionSecurity: SessionSecurityService,
    private readonly sseTickets: SseTicketService,
    private readonly statsCalculator: StatsCalculatorService,
    private readonly playerSpellProjection: PlayerSpellProjectionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSession(
    player1Id: string,
    player2Id: string | null,
    opts?: { vsAi?: boolean },
  ) {
    await this.sessionSecurity.assertPlayerAvailableForPublicRoom(player1Id);

    const bot = await this.prisma.player.findUnique({ where: { username: 'Bot' } });
    const isVsAi =
      opts?.vsAi === true ||
      (player2Id != null && bot?.id != null && player2Id === bot.id);

    if (player2Id && !isVsAi) {
      await this.sessionSecurity.assertPlayerAvailableForPublicRoom(player2Id);
    }

    try {
      const { ALL_SEED_IDS } = await import('@game/shared-types');
      const mapSeedId = ALL_SEED_IDS[Math.floor(Math.random() * ALL_SEED_IDS.length)];
      const mapSeed = Math.floor(Math.random() * 1000000);
      const session = await (this.prisma as any).gameSession.create({
        data: {
          player1Id,
          player2Id,
          status: player2Id ? 'ACTIVE' : 'WAITING',
          phase: 'FARMING',
          gold: 0,
          player1Po: 0,
          player2Po: 0,
          player2Ready: isVsAi,
          mapSeedId,
          mapSeed,
        },
        include: {
          p1: { select: { username: true } },
          p2: { select: { username: true } },
          combats: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      this.eventEmitter.emit(GAME_EVENTS.SESSION_CREATED, {
        sessionId: session.id,
        player1Id: session.player1Id,
        player2Id: session.player2Id,
      });

      return session;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Vous avez deja une room ouverte');
      }

      throw error;
    }
  }

  async createVsAiSession(player1Id: string, botPlayerId: string) {
    await this.cleanupStandaloneCombatSessions(player1Id);
    return this.createSession(player1Id, botPlayerId, { vsAi: true });
  }

  async getWaitingSessions() {
    return (this.prisma as any).gameSession.findMany({
      where: {
        status: 'WAITING',
        player2Id: null,
      },
      include: {
        p1: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async joinPrivateSession(sessionId: string, player2Id: string) {
    await this.sessionSecurity.assertCanJoinGameSession(sessionId, player2Id);

    const updatedCount = await (this.prisma as any).gameSession.updateMany({
      where: {
        id: sessionId,
        status: 'WAITING',
        player2Id: null,
      },
      data: {
        player2Id,
        status: 'ACTIVE',
      },
    });

    if (updatedCount.count !== 1) {
      throw new BadRequestException('Session deja pleine ou expiree');
    }

    const updated = await (this.prisma as any).gameSession.findUnique({
      where: { id: sessionId },
      include: {
        p1: { select: { username: true } },
        p2: { select: { username: true } },
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updated);
    return updated;
  }

  async getCurrentSession(playerId: string, sessionId?: string) {
    if (sessionId) {
      const session = await this.sessionSecurity.getGameSessionForParticipantOrThrow(sessionId, playerId);
      if (session.status !== 'WAITING' && session.status !== 'ACTIVE') {
        return null;
      }

      return session;
    }

    return this.sessionSecurity.getCurrentOpenGameSession(playerId);
  }

  async getActiveSession(playerId: string, sessionId?: string) {
    return this.getCurrentSession(playerId, sessionId);
  }

  async getSessionInventory(sessionId: string, playerId: string) {
    await this.sessionSecurity.getGameSessionForParticipantOrThrow(sessionId, playerId);

    return (this.prisma as any).sessionItem.findMany({
      where: { sessionId, playerId },
      include: { item: true },
    });
  }

  async setReady(sessionId: string, playerId: string, ready: boolean) {
    const session = await this.sessionSecurity.getGameSessionForParticipantOrThrow(sessionId, playerId);

    if (session.phase !== 'FARMING') {
      throw new BadRequestException(
        "Vous ne pouvez changer votre etat de pret qu'en phase de preparation",
      );
    }

    const isPlayer1 = session.player1Id === playerId;
    const isPlayer2 = session.player2Id === playerId;

    if (!isPlayer1 && !isPlayer2) {
      throw new BadRequestException('Joueur non autorise');
    }

    const updatedSession = await (this.prisma as any).gameSession.update({
      where: { id: sessionId },
      data: {
        player1Ready: isPlayer1 ? ready : session.player1Ready,
        player2Ready: isPlayer2 ? ready : session.player2Ready,
      },
      include: {
        p1: { select: { username: true } },
        p2: { select: { username: true } },
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    console.log(`[GameSession] Session ${sessionId} status: P1Ready=${updatedSession.player1Ready}, P2Ready=${updatedSession.player2Ready}`);
    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updatedSession);

    if (updatedSession.player1Ready && updatedSession.player2Ready) {
      console.log(`[GameSession] Both players ready! Starting next combat...`);
      await this.startMatch(sessionId);
    }

    return updatedSession;
  }

  private async startMatch(sessionId: string) {
    const session = await (this.prisma as any).gameSession.findUnique({ where: { id: sessionId } });
    if (!session) return;

    console.log(`[GameSession] Starting match for session ${sessionId} (Round ${session.currentRound})`);
    const combat = await this.sessionService.startSessionCombat(session.player1Id, session.player2Id!, session.id);
    console.log(`[GameSession] Created combat for session ${combat.sessionId}`);

    const updated = await (this.prisma as any).gameSession.update({
      where: { id: sessionId },
      data: {
        phase: 'FIGHTING',
        player1Ready: false,
        player2Ready: false,
      },
      include: {
        p1: { select: { username: true } },
        p2: { select: { username: true } },
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 1, // We only need the latest one to confirm
        },
      },
    });

    console.log(`[GameSession] Session ${sessionId} phase updated to FIGHTING. Combats count: ${updated.combats.length}`);
    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updated);
  }

  async endSession(sessionId: string, userId: string) {
    const sessionToEnd = await this.sessionSecurity.assertCanEndGameSession(sessionId, userId);

    const activeCombat = await this.prisma.combatSession.findFirst({
      where: {
        gameSessionId: sessionId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeCombat?.player2Id) {
      const winnerId = activeCombat.player1Id === userId ? activeCombat.player2Id : activeCombat.player1Id;
      await this.sessionService.endCombat(activeCombat.id, winnerId, userId);
    }

    await this.cleanupSessionArtifacts(sessionId, [sessionToEnd.player1Id, sessionToEnd.player2Id]);

    const session = await (this.prisma as any).gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'FINISHED',
        endedAt: new Date(),
        player1Ready: false,
        player2Ready: false,
      },
      include: {
        p1: { select: { username: true } },
        p2: { select: { username: true } },
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', session);
    return session;
  }

  async issueStreamTicket(sessionId: string, userId: string) {
    await this.sessionSecurity.getGameSessionForParticipantOrThrow(sessionId, userId);
    return this.sseTickets.issueTicket({
      userId,
      resourceId: sessionId,
      resourceType: 'game-session',
    });
  }

  @NestOnEvent(GAME_EVENTS.COMBAT_ENDED)
  async handleCombatEnded(payload: { winnerId: string; loserId: string; sessionId: string }) {
    console.log(`[GameSession] handleCombatEnded triggered for combat ${payload.sessionId}`);
    
    const combat = await this.prisma.combatSession.findUnique({
      where: { id: payload.sessionId },
      select: { gameSessionId: true },
    });

    if (!combat?.gameSessionId) {
      console.warn(`[GameSession] No linked gameSession found for combat ${payload.sessionId}`);
      return;
    }

    const sessionId = combat.gameSessionId;
    const session = await (this.prisma as any).gameSession.findUnique({
      where: { id: sessionId },
      include: { 
        p1: true, 
        p2: true,
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });

    if (!session) {
      return;
    }

    // Protection anti-race condition : on vérifie si ce combat est bien le dernier en date
    const latestCombatId = session.combats?.[0]?.id;
    if (latestCombatId && latestCombatId !== payload.sessionId) {
      console.warn(`[GameSession] Ignoring stale COMBAT_ENDED event for combat ${payload.sessionId}. Latest is ${latestCombatId}`);
      return;
    }

    if (session.phase === 'FARMING') {
      console.warn(`[GameSession] Ignoring COMBAT_ENDED event for combat ${payload.sessionId} because session is already in FARMING phase`);
      return;
    }

    const isPlayer1Winner = session.player1Id === payload.winnerId;
    const newWinsP1 = isPlayer1Winner ? session.player1Wins + 1 : session.player1Wins;
    const newWinsP2 = !isPlayer1Winner ? session.player2Wins + 1 : session.player2Wins;
    const isGameOver = newWinsP1 >= 3 || newWinsP2 >= 3;

    // Detect if the opponent is the Bot to auto-ready it for next round
    const isVsAi = session.p2?.username === 'Bot' || session.player2Id === null; // In VS AI sessions, player2Id might be the Bot ID or null if not yet linked, but usually it's the Bot ID.
    
    // Safety check: find Bot ID if not sure
    if (!isVsAi && session.player2Id) {
      const bot = await this.prisma.player.findUnique({ where: { username: 'Bot' } });
      if (session.player2Id === bot?.id) {
        (session as any).isVsAi = true;
      }
    }
    const finalIsVsAi = isVsAi || (session as any).isVsAi;
    
    console.log(`[GameSession] Transitioning session ${sessionId} to FARMING. VS AI: ${isVsAi}. Round: ${session.currentRound + 1}`);

    const updated = await (this.prisma as any).gameSession.update({
      where: { id: sessionId },
      data: {
        player1Wins: newWinsP1,
        player2Wins: newWinsP2,
        currentRound: session.currentRound + 1,
        phase: 'FARMING',
        player1Ready: false,
        player2Ready: finalIsVsAi, // Bot is always ready immediately
        status: isGameOver ? 'FINISHED' : 'ACTIVE',
        endedAt: isGameOver ? new Date() : null,
      },
      include: {
        p1: { select: { username: true } },
        p2: { select: { username: true } },
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    console.log(`[GameSession] Session ${sessionId} update complete. Phase: ${updated.phase}. P2Ready: ${updated.player2Ready}`);
    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updated);

    if (isGameOver) {
      await this.cleanupSessionArtifacts(sessionId, [session.player1Id, session.player2Id]);
    }
  }

  private async cleanupSessionArtifacts(sessionId: string, playerIds: Array<string | null | undefined>) {
    const uniquePlayerIds = [...new Set(playerIds.filter((playerId): playerId is string => Boolean(playerId)))];

    await Promise.all(uniquePlayerIds.map((playerId) => this.redis.del(`farming:${playerId}`)));

    const sessionItems = await (this.prisma as any).sessionItem.findMany({
      where: { sessionId },
      select: { id: true },
    });
    const sessionItemIds = sessionItems.map((item: { id: string }) => item.id);

    if (sessionItemIds.length > 0) {
      await this.prisma.equipmentSlot.updateMany({
        where: {
          playerId: { in: uniquePlayerIds },
          sessionItemId: { in: sessionItemIds },
        },
        data: { sessionItemId: null },
      });

      await (this.prisma as any).sessionItem.deleteMany({
        where: { sessionId },
      });
    }

    await Promise.all(uniquePlayerIds.map((playerId) => this.recomputePersistentLoadout(playerId)));
  }

  private async cleanupStandaloneCombatSessions(playerId: string) {
    const staleCombatSessions = await this.prisma.combatSession.findMany({
      where: {
        gameSessionId: null,
        status: { in: ['WAITING', 'ACTIVE'] },
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
      },
      select: { id: true },
    });

    if (staleCombatSessions.length === 0) {
      return;
    }

    const staleIds = staleCombatSessions.map((session) => session.id);
    await this.prisma.combatSession.updateMany({
      where: { id: { in: staleIds } },
      data: {
        status: 'FINISHED',
        endedAt: new Date(),
      },
    });
    await Promise.all(staleIds.map((sessionId) => this.redis.del(`combat:${sessionId}`)));
  }

  private async recomputePersistentLoadout(playerId: string) {
    const [baseStats, slots, playerSpellsData] = await Promise.all([
      this.prisma.playerStats.findUnique({
        where: { playerId },
      }),
      this.prisma.equipmentSlot.findMany({
        where: { playerId },
        include: {
          inventoryItem: {
            include: {
              item: true,
            },
          },
          sessionItem: {
            include: {
              item: true,
            },
          },
        },
      }),
      this.playerSpellProjection.buildPlayerSpellAssignments(playerId),
    ]);

    if (!baseStats) {
      return;
    }

    const effectiveStats = this.statsCalculator.computeEffectiveStatsFromSnapshot(baseStats, slots as any[]);

    await this.prisma.$transaction([
      this.prisma.playerStats.update({
        where: { playerId },
        data: effectiveStats,
      }),
      this.prisma.playerSpell.deleteMany({
        where: { playerId },
      }),
      ...(playerSpellsData.length > 0
        ? [
            this.prisma.playerSpell.createMany({
              data: playerSpellsData,
            }),
          ]
        : []),
    ]);
  }
}

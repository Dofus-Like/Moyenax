import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { OnEvent as NestOnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SessionService } from '../combat/session/session.service';
import { PlayerSpellProjectionService } from '../player/player-spell-projection.service';
import { StatsCalculatorService } from '../player/stats-calculator.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { RedisService } from '../shared/redis/redis.service';
import {
  DistributedLockService,
  LockNotAcquiredError,
} from '../shared/security/distributed-lock.service';
import { SessionSecurityService } from '../shared/security/session-security.service';
import { SseTicketService } from '../shared/security/sse-ticket.service';
import { SseService } from '../shared/sse/sse.service';

const START_MATCH_LOCK_TTL_SECONDS = 30;

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
    private readonly distributedLock: DistributedLockService,
  ) {}

  async createSession(player1Id: string, player2Id: string | null, opts?: { vsAi?: boolean }) {
    await this.sessionSecurity.assertPlayerAvailableForPublicRoom(player1Id);

    const bot = await this.prisma.player.findUnique({ where: { username: 'Bot' } });
    const isVsAi =
      opts?.vsAi === true ||
      (player2Id != null && bot?.id != null && player2Id === bot.id) ||
      (player2Id != null &&
        (await this.prisma.player.findUnique({ where: { id: player2Id } }))?.username
          .toLowerCase()
          .includes('bot'));

    if (player2Id && !isVsAi) {
      await this.sessionSecurity.assertPlayerAvailableForPublicRoom(player2Id);
    }

    try {
      const { ALL_SEED_IDS } = await import('@game/shared-types');
      const mapSeedId = ALL_SEED_IDS[Math.floor(Math.random() * ALL_SEED_IDS.length)];
      const mapSeed = Math.floor(Math.random() * 1000000);
      const session = await this.prisma.gameSession.create({
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

      this.eventEmitter.emit('game.session.created', {
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
    // 1. Check for an existing session first
    const existing = await this.prisma.gameSession.findFirst({
      where: {
        player1Id,
        status: { in: ['WAITING', 'ACTIVE'] },
      },
      include: {
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // 2. No session? Clean up potential old standalone combats then create
    await this.cleanupStandaloneCombatSessions(player1Id);
    return this.createSession(player1Id, botPlayerId, { vsAi: true });
  }

  async forceReset(playerId: string) {
    // 1. Find all active/waiting sessions
    const openSessions = await this.prisma.gameSession.findMany({
      where: {
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
        status: { in: ['WAITING', 'ACTIVE'] },
      },
    });

    // 2. End each session properly
    for (const session of openSessions) {
      await this.endSession(session.id, playerId);
    }

    // 3. Fallback: also clean up any standalone combats
    await this.cleanupStandaloneCombatSessions(playerId);

    return { success: true, count: openSessions.length };
  }

  async getWaitingSessions() {
    return this.prisma.gameSession.findMany({
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

    const updatedCount = await this.prisma.gameSession.updateMany({
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

    const updated = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        p1: { select: { username: true } },
        p2: { select: { username: true } },
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Only need the most recent
        },
      },
    });

    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updated);
    return updated;
  }

  async getCurrentSession(playerId: string, sessionId?: string) {
    if (sessionId) {
      const session = await this.sessionSecurity.getGameSessionForParticipantOrThrow(
        sessionId,
        playerId,
      );
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

    return this.prisma.sessionItem.findMany({
      where: { sessionId, playerId },
      include: { item: true },
    });
  }

  async setReady(sessionId: string, playerId: string, ready: boolean) {
    const session = await this.sessionSecurity.getGameSessionForParticipantOrThrow(
      sessionId,
      playerId,
    );

    if (session.phase !== 'FARMING') {
      console.warn(
        `[GameSession] REJECTED setReady: Session ${sessionId} is in phase ${session.phase}`,
      );
      throw new BadRequestException(
        "Vous ne pouvez changer votre etat de pret qu'en phase de preparation",
      );
    }

    const isPlayer1 = session.player1Id === playerId;
    const isPlayer2 = session.player2Id === playerId;

    if (!isPlayer1 && !isPlayer2) {
      throw new BadRequestException('Joueur non autorise');
    }

    const updatedSession = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        player1Ready: isPlayer1 ? ready : undefined,
        player2Ready: isPlayer2 ? ready : undefined,
      },
      include: {
        p1: true,
        p2: true,
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (updatedSession.player1Ready && updatedSession.player2Ready) {
      // CRITICAL: We await startMatch to ensure the phase update to FIGHTING is persisted
      // before we return the response or emit the final SSE event.
      // We ALSO skip the intermediate emission at line 210 in the logic below to avoid race.
      return this.startMatch(sessionId);
    }

    // Only emit intermediate update if match hasn't started
    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updatedSession);
    return updatedSession;
  }

  private async startMatch(sessionId: string) {
    const lockKey = `game-session:startMatch:${sessionId}`;
    try {
      return await this.distributedLock.withLock(
        lockKey,
        START_MATCH_LOCK_TTL_SECONDS,
        () => this.runStartMatch(sessionId),
      );
    } catch (error) {
      if (error instanceof LockNotAcquiredError) {
        console.warn(`[GameSession] startMatch already in progress for session ${sessionId}.`);
        return this.prisma.gameSession.findUnique({
          where: { id: sessionId },
          include: { combats: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
      }
      throw error;
    }
  }

  private async runStartMatch(sessionId: string) {
    try {
      const session = await (this.prisma as any).gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) return;
      if (session.phase === 'FIGHTING') {
        console.warn(
          `[GameSession] Session ${sessionId} is already in FIGHTING phase. Skipping startMatch.`,
        );
        return;
      }

      if (!session.player2Id) {
        throw new BadRequestException('Player 2 is missing from session');
      }

      const combat = await this.sessionService.startSessionCombat(
        session.player1Id,
        session.player2Id,
        session.id,
      );

      const updated = await this.prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          phase: 'FIGHTING',
          player1Ready: false,
          player2Ready: false,
        },
        include: {
          p1: true,
          p2: true,
          combats: {
            orderBy: { createdAt: 'desc' },
            take: 1, // We only need the latest one to confirm
          },
        },
      });

      this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updated);
      return updated;
    } catch (error) {
      console.error(`[GameSession] CRITICAL ERROR in startMatch for session ${sessionId}:`, error);
      // Reset readiness to allow the user to try again
      try {
        const botId = (await this.prisma.player.findUnique({ where: { username: 'Bot' } }))?.id;
        const currentSession = await this.prisma.gameSession.findUnique({
          where: { id: sessionId },
        });
        const resetSession = await this.prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            player1Ready: false,
            player2Ready: currentSession?.player2Id === botId, // Only ready if it's a bot
          },
        });
        this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', resetSession);
        return resetSession;
      } catch (e) {
        console.error(`[GameSession] Failed to reset readiness for ${sessionId}:`, e);
      }
      this.sse.emit(`game-session:${sessionId}`, 'ERROR', {
        message: "Le combat n'a pas pu démarrer",
        error: (error as Error).message,
      });
      return this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    }
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
      const winnerId =
        activeCombat.player1Id === userId ? activeCombat.player2Id : activeCombat.player1Id;
      await this.sessionService.endCombat(activeCombat.id, winnerId, userId);
    }

    await this.cleanupSessionArtifacts(sessionId, [sessionToEnd.player1Id, sessionToEnd.player2Id]);

    const session = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'FINISHED',
        endedAt: new Date(),
        player1Ready: false,
        player2Ready: false,
      },
      include: {
        p1: true,
        p2: true,
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 1,
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

  @NestOnEvent('combat.ended')
  async handleCombatEnded(payload: { winnerId: string; loserId: string; sessionId: string }) {
    const combatId = payload.sessionId;
    const combat = await this.prisma.combatSession.findUnique({
      where: { id: combatId },
      select: { gameSessionId: true },
    });

    const gameSessionId = combat?.gameSessionId;

    if (!gameSessionId) {
      console.warn(`[GameSession] No linked gameSession found for combat ${combatId}`);
      return;
    }

    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        p1: true,
        p2: true,
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!session) {
      console.error(
        `[DEBUG-GSS] [${new Date().toISOString()}] CRITICAL: Game session ${gameSessionId} not found for combat ${combatId}`,
      );
      return;
    }

    const latestCombatId = session.combats?.[0]?.id;
    if (latestCombatId && latestCombatId !== combatId) {
      console.warn(
        `[DEBUG-GSS] [${new Date().toISOString()}] REJECTED stale COMBAT_ENDED event for combat ${combatId}. Latest is ${latestCombatId}`,
      );
      return;
    }

    if (session.phase === 'FARMING') {
      console.warn(
        `[GameSession] Session ${gameSessionId} already in FARMING. Ignoring combat end for ${combatId}`,
      );
      return;
    }

    const isPlayer1Winner = session.player1Id === payload.winnerId;
    const newWinsP1 = isPlayer1Winner ? session.player1Wins + 1 : session.player1Wins;
    const newWinsP2 = !isPlayer1Winner ? session.player2Wins + 1 : session.player2Wins;
    const isGameOver = newWinsP1 >= 3 || newWinsP2 >= 3;

    const botUsernames = ['Bot', 'BotWarrior', 'BotMage', 'BotRanger'];
    const isVsAi = botUsernames.includes(session.p2?.username || '') || session.player2Id === null;

    let finalIsVsAi = isVsAi;
    if (!finalIsVsAi && session.p2?.username.toLowerCase().includes('bot')) {
      finalIsVsAi = true;
    }

    try {
      const updated = await this.prisma.gameSession.update({
        where: {
          id: gameSessionId,
          phase: 'FIGHTING',
        },
        data: {
          player1Wins: newWinsP1,
          player2Wins: newWinsP2,
          currentRound: isGameOver ? session.currentRound : session.currentRound + 1,
          phase: 'FARMING',
          player1Ready: false,
          player2Ready: finalIsVsAi,
          status: isGameOver ? 'FINISHED' : 'ACTIVE',
          endedAt: isGameOver ? new Date() : null,
          player1Po: isPlayer1Winner ? { increment: 50 } : undefined, // Potential PO reward
          player2Po: !isPlayer1Winner ? { increment: 50 } : undefined,
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

      this.sse.emit(`game-session:${gameSessionId}`, 'SESSION_UPDATED', updated);

      if (isGameOver) {
        await this.cleanupSessionArtifacts(gameSessionId, [session.player1Id, session.player2Id]);
      }
    } catch (error) {
      console.warn(
        `[GameSession] handleCombatEnded: Update failed for session ${gameSessionId}. It may have already transitioned. Error: ${(error as any).message}`,
      );
    }
  }

  private async cleanupSessionArtifacts(
    sessionId: string,
    playerIds: Array<string | null | undefined>,
  ) {
    const uniquePlayerIds = [
      ...new Set(playerIds.filter((playerId): playerId is string => Boolean(playerId))),
    ];

    await Promise.all(uniquePlayerIds.map((playerId) => this.redis.del(`farming:${playerId}`)));

    const sessionItems = await this.prisma.sessionItem.findMany({
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

      await this.prisma.sessionItem.deleteMany({
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

    const effectiveStats = this.statsCalculator.computeEffectiveStatsFromSnapshot(
      baseStats,
      slots as unknown as any[],
    );

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

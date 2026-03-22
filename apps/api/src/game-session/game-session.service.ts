import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent as NestOnEvent } from '@nestjs/event-emitter';
import { GAME_EVENTS } from '@game/shared-types';
import { SessionService } from '../combat/session/session.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { SessionSecurityService } from '../shared/security/session-security.service';
import { SseTicketService } from '../shared/security/sse-ticket.service';
import { SseService } from '../shared/sse/sse.service';

@Injectable()
export class GameSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sse: SseService,
    private readonly sessionService: SessionService,
    private readonly sessionSecurity: SessionSecurityService,
    private readonly sseTickets: SseTicketService,
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

    return (this.prisma as any).gameSession.create({
      data: {
        player1Id,
        player2Id,
        status: player2Id ? 'ACTIVE' : 'WAITING',
        phase: 'FARMING',
        gold: 0,
        player1Po: 0,
        player2Po: 0,
        player2Ready: isVsAi,
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

    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updatedSession);

    if (updatedSession.player1Ready && updatedSession.player2Ready) {
      await this.startMatch(sessionId);
    }

    return updatedSession;
  }

  private async startMatch(sessionId: string) {
    const session = await (this.prisma as any).gameSession.findUnique({ where: { id: sessionId } });
    if (!session) return;

    await this.sessionService.startSessionCombat(session.player1Id, session.player2Id!, session.id);

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
          take: 5,
        },
      },
    });

    this.sse.emit(`game-session:${sessionId}`, 'SESSION_UPDATED', updated);
  }

  async endSession(sessionId: string, userId: string) {
    await this.sessionSecurity.assertCanEndGameSession(sessionId, userId);

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
    const combat = await this.prisma.combatSession.findUnique({
      where: { id: payload.sessionId },
      select: { gameSessionId: true },
    });

    if (!combat?.gameSessionId) {
      return;
    }

    const session = await (this.prisma as any).gameSession.findUnique({
      where: { id: combat.gameSessionId },
    });

    if (!session) {
      return;
    }

    const isPlayer1Winner = session.player1Id === payload.winnerId;
    const newWinsP1 = isPlayer1Winner ? session.player1Wins + 1 : session.player1Wins;
    const newWinsP2 = !isPlayer1Winner ? session.player2Wins + 1 : session.player2Wins;
    const isGameOver = newWinsP1 >= 3 || newWinsP2 >= 3;

    const updated = await (this.prisma as any).gameSession.update({
      where: { id: session.id },
      data: {
        player1Wins: newWinsP1,
        player2Wins: newWinsP2,
        currentRound: session.currentRound + 1,
        phase: 'FARMING',
        player1Ready: false,
        player2Ready: false,
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

    this.sse.emit(`game-session:${session.id}`, 'SESSION_UPDATED', updated);
  }
}

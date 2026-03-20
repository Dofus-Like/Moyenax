import { Injectable, BadRequestException } from '@nestjs/common';
import { OnEvent as NestOnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../shared/prisma/prisma.service';
import { GAME_EVENTS } from '@game/shared-types';
import { SseService } from '../shared/sse/sse.service';
import { SessionService } from '../combat/session/session.service';

@Injectable()
export class GameSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sse: SseService,
    private readonly sessionService: SessionService,
  ) {}

  async createSession(player1Id: string, player2Id: string | null) {
    const bot = await (this.prisma as any).player.findUnique({ where: { username: 'Bot' } });
    const isVsAi = player2Id === bot?.id;

    return (this.prisma as any).gameSession.create({
      data: {
        player1Id,
        player2Id,
        status: player2Id ? 'ACTIVE' : 'WAITING',
        phase: 'FARMING',
        gold: 500,
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
    const session = await (this.prisma as any).gameSession.findUnique({
      where: { id: sessionId },
    }) as any;

    if (!session) throw new BadRequestException('Session introuvable');
    if (session.status !== 'WAITING') throw new BadRequestException('Session déjà pleine ou expirée');
    if (session.player1Id === player2Id) throw new BadRequestException('Vous ne pouvez pas rejoindre votre propre session');

    const updated = await (this.prisma as any).gameSession.update({
      where: { id: sessionId },
      data: {
        player2Id,
        status: 'ACTIVE',
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
    return updated;
  }

  async getActiveSession(playerId: string) {
    return (this.prisma as any).gameSession.findFirst({
      where: {
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
        status: 'ACTIVE',
      },
      include: {
        inventory: {
          include: { item: true },
        },
        combats: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  async getSessionInventory(sessionId: string, playerId: string) {
    return (this.prisma as any).sessionItem.findMany({
      where: { sessionId, playerId },
      include: { item: true },
    });
  }

  async setReady(sessionId: string, playerId: string, ready: boolean) {
    const session = await (this.prisma as any).gameSession.findUnique({
      where: { id: sessionId },
    }) as any;

    if (!session) throw new BadRequestException('Session introuvable');
    if (session.phase !== 'FARMING') {
      throw new BadRequestException("Vous ne pouvez changer votre état de prêt qu'en phase de préparation");
    }

    const isPlayer1 = session.player1Id === playerId;
    const isPlayer2 = session.player2Id === playerId;

    if (!isPlayer1 && !isPlayer2) throw new BadRequestException('Joueur non autorisé');

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
    const session = await (this.prisma as any).gameSession.findUnique({ where: { id: sessionId } }) as any;
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

  async endSession(sessionId: string) {
    const session = await (this.prisma as any).gameSession.update({
      where: { id: sessionId },
      data: { status: 'FINISHED' },
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

  @NestOnEvent(GAME_EVENTS.COMBAT_ENDED)
  async handleCombatEnded(payload: { winnerId: string; loserId: string; sessionId: string }) {
    const combat = await this.prisma.combatSession.findUnique({
      where: { id: payload.sessionId },
      select: { gameSessionId: true },
    });

    if (combat?.gameSessionId) {
      const session = await (this.prisma as any).gameSession.findUnique({
        where: { id: combat.gameSessionId },
      }) as any;

      if (!session) return;

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
          status: isGameOver ? 'FINISHED' : 'ACTIVE',
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
}

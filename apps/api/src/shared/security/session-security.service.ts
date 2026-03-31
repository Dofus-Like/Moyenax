import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OPEN_SESSION_STATUSES } from './security.constants';
import { MatchmakingQueueStore } from './matchmaking-queue.store';

@Injectable()
export class SessionSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchmakingQueue: MatchmakingQueueStore,
  ) {}

  async isPlayerQueued(playerId: string): Promise<boolean> {
    return this.matchmakingQueue.isQueued(playerId);
  }

  async assertPlayerAvailableForPublicRoom(
    playerId: string,
    opts?: { ignoreGameSessionId?: string; ignoreCombatSessionId?: string },
  ): Promise<void> {
    if (await this.isPlayerQueued(playerId)) {
      throw new ConflictException('Vous etes deja dans la file de matchmaking');
    }

    const [gameSession, combatSession] = await Promise.all([
      (this.prisma as any).gameSession.findFirst({
        where: {
          ...(opts?.ignoreGameSessionId ? { id: { not: opts.ignoreGameSessionId } } : {}),
          status: { in: [...OPEN_SESSION_STATUSES] },
          OR: [{ player1Id: playerId }, { player2Id: playerId }],
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.combatSession.findFirst({
        where: {
          ...(opts?.ignoreCombatSessionId ? { id: { not: opts.ignoreCombatSessionId } } : {}),
          gameSessionId: null,
          status: { in: [...OPEN_SESSION_STATUSES] },
          OR: [{ player1Id: playerId }, { player2Id: playerId }],
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (gameSession || combatSession) {
      throw new ConflictException('Vous avez deja une room ouverte');
    }
  }

  async getCurrentOpenGameSession(playerId: string) {
    return (this.prisma as any).gameSession.findFirst({
      where: {
        status: { in: [...OPEN_SESSION_STATUSES] },
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
      },
      orderBy: { createdAt: 'desc' },
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

  async getGameSessionForParticipantOrThrow(sessionId: string, userId: string) {
    const session = await (this.prisma as any).gameSession.findUnique({
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

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    if (session.player1Id !== userId && session.player2Id !== userId) {
      throw new ForbiddenException('Acces interdit a cette session');
    }

    return session;
  }

  async assertCanJoinGameSession(sessionId: string, userId: string) {
    const session = await (this.prisma as any).gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    if (session.player1Id === userId) {
      throw new BadRequestException('Vous ne pouvez pas rejoindre votre propre session');
    }

    if (session.status !== 'WAITING' || session.player2Id) {
      throw new BadRequestException('Session deja pleine ou expiree');
    }

    await this.assertPlayerAvailableForPublicRoom(userId);
    return session;
  }

  async assertCanEndGameSession(sessionId: string, userId: string) {
    const session = await this.getGameSessionForParticipantOrThrow(sessionId, userId);

    if (session.status === 'WAITING' && session.player1Id !== userId) {
      throw new ForbiddenException('Seul le createur peut annuler une room en attente');
    }

    return session;
  }

  async getCombatSessionForParticipantOrThrow(sessionId: string, userId: string) {
    const session = await this.prisma.combatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    if (session.player1Id !== userId && session.player2Id !== userId) {
      throw new ForbiddenException('Acces interdit a cette session de combat');
    }

    return session;
  }

  async assertCanAcceptCombatSession(sessionId: string, userId: string) {
    const session = await this.prisma.combatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    if (session.player1Id === userId) {
      throw new BadRequestException('Impossible de rejoindre sa propre room');
    }

    if (session.status !== 'WAITING') {
      throw new BadRequestException('Cette session ne peut plus etre acceptee');
    }

    if (session.player2Id && session.player2Id !== userId) {
      throw new ForbiddenException('Seul le joueur invite peut accepter ce defi');
    }

    const isBot =
      (await this.prisma.player.findUnique({
        where: { id: userId },
        select: { username: true },
      }))?.username === 'Bot';

    if (!isBot) {
      await this.assertPlayerAvailableForPublicRoom(userId, {
        ignoreCombatSessionId: sessionId,
        ...(session.gameSessionId ? { ignoreGameSessionId: session.gameSessionId } : {}),
      });
    }

    return session;
  }
}

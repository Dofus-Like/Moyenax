import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GameSessionService } from '../../game-session/game-session.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

type OpenGameSession = {
  id: string;
  player1Id: string;
  player2Id: string | null;
  player1Po: number;
  player2Po: number;
};

@Injectable()
export class SpendableGoldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameSession: GameSessionService,
  ) {}

  async getContext(playerId: string, session?: OpenGameSession | null) {
    const resolvedSession = session === undefined ? await this.gameSession.getActiveSession(playerId) : session;

    if (resolvedSession) {
      return {
        session: resolvedSession,
        balance: this.getSessionBalance(playerId, resolvedSession),
      };
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { gold: true },
    });

    if (!player) {
      throw new NotFoundException('Joueur introuvable');
    }

    return {
      session: null,
      balance: player.gold,
    };
  }

  async getBalance(playerId: string, session?: OpenGameSession | null) {
    const { balance } = await this.getContext(playerId, session);
    return balance;
  }

  async credit(playerId: string, amount: number, session?: OpenGameSession | null) {
    if (amount < 0) {
      throw new BadRequestException('Le montant a crediter doit etre positif');
    }

    if (session) {
      const updated = await (this.prisma as any).gameSession.update({
        where: { id: session.id },
        data:
          session.player1Id === playerId
            ? { player1Po: { increment: amount } }
            : { player2Po: { increment: amount } },
        select: { player1Po: true, player2Po: true },
      });

      return session.player1Id === playerId ? updated.player1Po : updated.player2Po;
    }

    const updatedPlayer = await this.prisma.player.update({
      where: { id: playerId },
      data: { gold: { increment: amount } },
      select: { gold: true },
    });

    return updatedPlayer.gold;
  }

  async debitOrThrowInTransaction(
    tx: Prisma.TransactionClient,
    playerId: string,
    amount: number,
    session: OpenGameSession | null,
    insufficientMessage: string,
  ) {
    if (amount < 0) {
      throw new BadRequestException('Le montant a debiter doit etre positif');
    }

    if (amount === 0) {
      if (session) {
        const freshSession = await (tx as any).gameSession.findUnique({
          where: { id: session.id },
          select: { player1Id: true, player2Id: true, player1Po: true, player2Po: true },
        });

        if (!freshSession) {
          throw new NotFoundException('Session de jeu introuvable');
        }

        return this.getSessionBalance(playerId, freshSession);
      }

      const player = await tx.player.findUnique({
        where: { id: playerId },
        select: { gold: true },
      });

      if (!player) {
        throw new NotFoundException('Joueur introuvable');
      }

      return player.gold;
    }

    if (session) {
      const freshSession = await (tx as any).gameSession.findUnique({
        where: { id: session.id },
        select: { player1Id: true, player2Id: true, player1Po: true, player2Po: true },
      });

      if (!freshSession) {
        throw new NotFoundException('Session de jeu introuvable');
      }

      const currentBalance = this.getSessionBalance(playerId, freshSession);
      if (currentBalance < amount) {
        throw new BadRequestException(insufficientMessage);
      }

      const updated = await (tx as any).gameSession.update({
        where: { id: session.id },
        data:
          freshSession.player1Id === playerId
            ? { player1Po: { decrement: amount } }
            : { player2Po: { decrement: amount } },
        select: { player1Po: true, player2Po: true },
      });

      return freshSession.player1Id === playerId ? updated.player1Po : updated.player2Po;
    }

    const player = await tx.player.findUnique({
      where: { id: playerId },
      select: { gold: true },
    });

    if (!player) {
      throw new NotFoundException('Joueur introuvable');
    }

    if (player.gold < amount) {
      throw new BadRequestException(insufficientMessage);
    }

    const updatedPlayer = await tx.player.update({
      where: { id: playerId },
      data: { gold: { decrement: amount } },
      select: { gold: true },
    });

    return updatedPlayer.gold;
  }

  async creditInTransaction(
    tx: Prisma.TransactionClient,
    playerId: string,
    amount: number,
    session: OpenGameSession | null,
  ) {
    if (amount < 0) {
      throw new BadRequestException('Le montant a crediter doit etre positif');
    }

    if (session) {
      const updated = await (tx as any).gameSession.update({
        where: { id: session.id },
        data:
          session.player1Id === playerId
            ? { player1Po: { increment: amount } }
            : { player2Po: { increment: amount } },
        select: { player1Po: true, player2Po: true },
      });

      return session.player1Id === playerId ? updated.player1Po : updated.player2Po;
    }

    const updatedPlayer = await tx.player.update({
      where: { id: playerId },
      data: { gold: { increment: amount } },
      select: { gold: true },
    });

    return updatedPlayer.gold;
  }

  private getSessionBalance(playerId: string, session: OpenGameSession) {
    return session.player1Id === playerId ? session.player1Po ?? 0 : session.player2Po ?? 0;
  }
}

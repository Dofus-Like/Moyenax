import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SpendableGoldService } from './spendable-gold.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GameSessionService } from '../../game-session/game-session.service';

describe('SpendableGoldService', () => {
  let service: SpendableGoldService;
  let prisma: {
    player: { findUnique: jest.Mock; update: jest.Mock };
    gameSession: { update: jest.Mock };
  };
  let gameSession: { getActiveSession: jest.Mock };

  const tx: any = {
    player: { findUnique: jest.fn(), update: jest.fn() },
    gameSession: { findUnique: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      player: { findUnique: jest.fn(), update: jest.fn() },
      gameSession: { update: jest.fn() },
    } as any;
    gameSession = { getActiveSession: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpendableGoldService,
        { provide: PrismaService, useValue: prisma },
        { provide: GameSessionService, useValue: gameSession },
      ],
    }).compile();

    service = module.get(SpendableGoldService);
  });

  describe('getContext & getBalance', () => {
    it('retourne le gold du player s\'il n\'y a pas de session', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue({ gold: 500 });
      expect(await service.getBalance('p1')).toBe(500);
    });

    it('throw NotFoundException si le joueur n\'existe pas', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.getContext('p1')).rejects.toThrow(NotFoundException);
    });

    it('retourne player1Po si session et player = player1', async () => {
      const session = { id: 's', player1Id: 'p1', player2Id: 'p2', player1Po: 150, player2Po: 200 };
      gameSession.getActiveSession.mockResolvedValue(session);
      expect(await service.getBalance('p1')).toBe(150);
    });

    it('retourne player2Po si session et player = player2', async () => {
      const session = { id: 's', player1Id: 'p1', player2Id: 'p2', player1Po: 150, player2Po: 200 };
      gameSession.getActiveSession.mockResolvedValue(session);
      expect(await service.getBalance('p2')).toBe(200);
    });

    it('retourne 0 si session.playerXPo est null', async () => {
      const session = {
        id: 's',
        player1Id: 'p1',
        player2Id: 'p2',
        player1Po: null,
        player2Po: null,
      } as any;
      gameSession.getActiveSession.mockResolvedValue(session);
      expect(await service.getBalance('p1')).toBe(0);
    });
  });

  describe('credit', () => {
    it('rejette montant négatif', async () => {
      await expect(service.credit('p1', -5)).rejects.toThrow(BadRequestException);
    });

    it('incrémente le gold du player hors session', async () => {
      prisma.player.update.mockResolvedValue({ gold: 250 });
      const r = await service.credit('p1', 50, null);
      expect(r).toBe(250);
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { gold: { increment: 50 } },
        select: { gold: true },
      });
    });

    it('incrémente player1Po en session', async () => {
      prisma.gameSession.update.mockResolvedValue({ player1Po: 300, player2Po: 50 });
      const session = { id: 's', player1Id: 'p1', player2Id: 'p2', player1Po: 200, player2Po: 50 };
      const r = await service.credit('p1', 100, session);
      expect(r).toBe(300);
    });

    it('incrémente player2Po en session', async () => {
      prisma.gameSession.update.mockResolvedValue({ player1Po: 200, player2Po: 150 });
      const session = { id: 's', player1Id: 'p1', player2Id: 'p2', player1Po: 200, player2Po: 50 };
      const r = await service.credit('p2', 100, session);
      expect(r).toBe(150);
    });
  });

  describe('debitOrThrowInTransaction', () => {
    it('rejette montant négatif', async () => {
      await expect(
        service.debitOrThrowInTransaction(tx, 'p1', -5, null, 'err'),
      ).rejects.toThrow(BadRequestException);
    });

    it('gère amount=0 hors session (retourne le balance courant)', async () => {
      tx.player.findUnique.mockResolvedValue({ gold: 100 });
      const r = await service.debitOrThrowInTransaction(tx, 'p1', 0, null, 'err');
      expect(r).toBe(100);
      expect(tx.player.update).not.toHaveBeenCalled();
    });

    it('throw NotFoundException si player n\'existe pas', async () => {
      tx.player.findUnique.mockResolvedValue(null);
      await expect(
        service.debitOrThrowInTransaction(tx, 'p1', 10, null, 'err'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throw BadRequest si gold insuffisant hors session', async () => {
      tx.player.findUnique.mockResolvedValue({ gold: 5 });
      await expect(
        service.debitOrThrowInTransaction(tx, 'p1', 100, null, 'pas assez'),
      ).rejects.toThrow(/pas assez/);
    });

    it('décrémente gold correctement et retourne nouveau balance', async () => {
      tx.player.findUnique.mockResolvedValue({ gold: 500 });
      tx.player.update.mockResolvedValue({ gold: 400 });
      const r = await service.debitOrThrowInTransaction(tx, 'p1', 100, null, 'err');
      expect(r).toBe(400);
    });

    it('[en session] relit la session en DB avant de vérifier balance (protection contre stale read)', async () => {
      const session = { id: 's', player1Id: 'p1', player2Id: 'p2' } as any;
      tx.gameSession.findUnique.mockResolvedValue({
        player1Id: 'p1',
        player2Id: 'p2',
        player1Po: 200,
        player2Po: 50,
      });
      tx.gameSession.update.mockResolvedValue({ player1Po: 100, player2Po: 50 });

      const r = await service.debitOrThrowInTransaction(tx, 'p1', 100, session, 'err');
      expect(tx.gameSession.findUnique).toHaveBeenCalled();
      expect(r).toBe(100);
    });

    it('[en session] throw BadRequest si po insuffisants', async () => {
      tx.gameSession.findUnique.mockResolvedValue({
        player1Id: 'p1',
        player2Id: 'p2',
        player1Po: 10,
        player2Po: 50,
      });
      const session = { id: 's', player1Id: 'p1', player2Id: 'p2' } as any;
      await expect(
        service.debitOrThrowInTransaction(tx, 'p1', 100, session, 'pas assez'),
      ).rejects.toThrow(/pas assez/);
    });

    it('[en session] throw NotFound si session disparue entre-temps', async () => {
      tx.gameSession.findUnique.mockResolvedValue(null);
      const session = { id: 's' } as any;
      await expect(
        service.debitOrThrowInTransaction(tx, 'p1', 10, session, 'err'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('creditInTransaction', () => {
    it('rejette montant négatif', async () => {
      await expect(service.creditInTransaction(tx, 'p1', -5, null)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('incrémente gold hors session', async () => {
      tx.player.update.mockResolvedValue({ gold: 250 });
      const r = await service.creditInTransaction(tx, 'p1', 50, null);
      expect(r).toBe(250);
    });

    it('incrémente player1Po en session pour player1', async () => {
      tx.gameSession.update.mockResolvedValue({ player1Po: 300, player2Po: 0 });
      const session = { id: 's', player1Id: 'p1', player2Id: 'p2' } as any;
      const r = await service.creditInTransaction(tx, 'p1', 100, session);
      expect(r).toBe(300);
    });

    it('incrémente player2Po en session pour player2', async () => {
      tx.gameSession.update.mockResolvedValue({ player1Po: 0, player2Po: 150 });
      const session = { id: 's', player1Id: 'p1', player2Id: 'p2' } as any;
      const r = await service.creditInTransaction(tx, 'p2', 100, session);
      expect(r).toBe(150);
    });
  });
});

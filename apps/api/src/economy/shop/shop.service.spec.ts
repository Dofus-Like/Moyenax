import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShopService } from './shop.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GameSessionService } from '../../game-session/game-session.service';
import { SpendableGoldService } from '../shared/spendable-gold.service';

describe('ShopService', () => {
  let service: ShopService;
  let prisma: {
    item: { findUnique: jest.Mock; findMany: jest.Mock };
    sessionItem: { findUnique: jest.Mock };
    inventoryItem: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let gameSession: { getActiveSession: jest.Mock };
  let spendable: {
    debitOrThrowInTransaction: jest.Mock;
    creditInTransaction: jest.Mock;
  };

  // Mock du client tx fourni par Prisma
  const txMock = {
    inventoryItem: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'new-inv', quantity: 1 }),
      update: jest.fn().mockResolvedValue({ id: 'upd-inv' }),
      delete: jest.fn(),
    },
    sessionItem: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'new-si' }),
      update: jest.fn().mockResolvedValue({ id: 'upd-si' }),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      item: { findUnique: jest.fn(), findMany: jest.fn() },
      sessionItem: { findUnique: jest.fn() },
      inventoryItem: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb) => cb(txMock)),
    };
    gameSession = { getActiveSession: jest.fn().mockResolvedValue(null) };
    spendable = {
      debitOrThrowInTransaction: jest.fn().mockResolvedValue(undefined),
      creditInTransaction: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        { provide: PrismaService, useValue: prisma },
        { provide: GameSessionService, useValue: gameSession },
        { provide: SpendableGoldService, useValue: spendable },
      ],
    }).compile();

    service = module.get(ShopService);
  });

  describe('getAvailableItems', () => {
    it('filtre les items avec shopPrice non null', async () => {
      prisma.item.findMany.mockResolvedValue([{ id: 'a' }]);
      const r = await service.getAvailableItems();
      expect(r).toEqual([{ id: 'a' }]);
      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: { shopPrice: { not: null } },
      });
    });
  });

  describe('buy', () => {
    it('throw NotFound si item inexistant', async () => {
      prisma.item.findUnique.mockResolvedValue(null);
      await expect(service.buy('p1', 'item-x', 1)).rejects.toThrow(NotFoundException);
    });

    it('throw NotFound si shopPrice=null (pas en vente)', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'i', shopPrice: null });
      await expect(service.buy('p1', 'i', 1)).rejects.toThrow(NotFoundException);
    });

    it('débite correctement totalCost = price * quantity', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'i', shopPrice: 50 });
      txMock.inventoryItem.findUnique.mockResolvedValue(null);
      await service.buy('p1', 'i', 3);
      expect(spendable.debitOrThrowInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        'p1',
        150,
        null,
        expect.any(String),
      );
    });

    it('achat hors session: crée un inventoryItem rank=1 si inexistant', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'i', shopPrice: 50 });
      gameSession.getActiveSession.mockResolvedValue(null);
      txMock.inventoryItem.findUnique.mockResolvedValue(null);
      await service.buy('p1', 'i', 2);
      expect(txMock.inventoryItem.create).toHaveBeenCalledWith({
        data: { playerId: 'p1', itemId: 'i', quantity: 2, rank: 1 },
        include: { item: true },
      });
    });

    it('achat hors session: increment si inventoryItem existant', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'i', shopPrice: 50 });
      gameSession.getActiveSession.mockResolvedValue(null);
      txMock.inventoryItem.findUnique.mockResolvedValue({ id: 'existing-1' });
      await service.buy('p1', 'i', 2);
      expect(txMock.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
        data: { quantity: { increment: 2 } },
        include: { item: true },
      });
    });

    it('achat en session: utilise sessionItem', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'i', shopPrice: 50 });
      gameSession.getActiveSession.mockResolvedValue({ id: 'gs-1' });
      txMock.sessionItem.findUnique.mockResolvedValue(null);
      await service.buy('p1', 'i', 1);
      expect(txMock.sessionItem.create).toHaveBeenCalled();
    });
  });

  describe('sell', () => {
    it('throw NotFound si item introuvable', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(null);
      await expect(service.sell('p1', 'inv-x', 1)).rejects.toThrow(NotFoundException);
    });

    it('throw NotFound si item n\'appartient pas au joueur', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-x',
        playerId: 'other',
        quantity: 5,
        item: { shopPrice: 100 },
      });
      await expect(service.sell('p1', 'inv-x', 1)).rejects.toThrow(/non trouvé/);
    });

    it('throw BadRequest si quantité insuffisante', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-x',
        playerId: 'p1',
        quantity: 2,
        item: { shopPrice: 100 },
      });
      await expect(service.sell('p1', 'inv-x', 5)).rejects.toThrow(BadRequestException);
    });

    it('crédite 50% du prix (floor) * quantité', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-x',
        playerId: 'p1',
        quantity: 5,
        item: { shopPrice: 99 }, // floor(99 * 0.5) = 49
      });
      const r = await service.sell('p1', 'inv-x', 3);
      expect(spendable.creditInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        'p1',
        147, // 49 * 3
        null,
      );
      expect(r).toEqual({ soldQuantity: 3, goldEarned: 147 });
    });

    it('supprime l\'inventoryItem si on vend toute la quantité', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-x',
        playerId: 'p1',
        quantity: 3,
        item: { shopPrice: 100 },
      });
      await service.sell('p1', 'inv-x', 3);
      expect(txMock.inventoryItem.delete).toHaveBeenCalledWith({ where: { id: 'inv-x' } });
    });

    it('décrémente la quantité si on en garde', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-x',
        playerId: 'p1',
        quantity: 10,
        item: { shopPrice: 100 },
      });
      await service.sell('p1', 'inv-x', 3);
      expect(txMock.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-x' },
        data: { quantity: { decrement: 3 } },
      });
    });

    it('utilise sessionItem si session active', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'gs' });
      prisma.sessionItem.findUnique = jest.fn().mockResolvedValue({
        id: 'si-1',
        playerId: 'p1',
        quantity: 5,
        item: { shopPrice: 100 },
      });
      await service.sell('p1', 'si-1', 2);
      expect(txMock.sessionItem.update).toHaveBeenCalled();
    });
  });
});

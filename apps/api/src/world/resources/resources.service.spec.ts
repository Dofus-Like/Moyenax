import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesService } from './resources.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GameSessionService } from '../../game-session/game-session.service';

describe('ResourcesService', () => {
  let service: ResourcesService;
  let prisma: {
    item: { findMany: jest.Mock; findUnique: jest.Mock };
    inventoryItem: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    sessionItem: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let gameSession: { getActiveSession: jest.Mock };

  beforeEach(async () => {
    prisma = {
      item: { findMany: jest.fn(), findUnique: jest.fn() },
      inventoryItem: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      sessionItem: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    gameSession = { getActiveSession: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        { provide: PrismaService, useValue: prisma },
        { provide: GameSessionService, useValue: gameSession },
      ],
    }).compile();
    service = module.get(ResourcesService);
  });

  it('findAll retourne seulement les items type RESOURCE', async () => {
    prisma.item.findMany.mockResolvedValue([{ id: 'wood', type: 'RESOURCE' }]);
    const r = await service.findAll();
    expect(r).toEqual([{ id: 'wood', type: 'RESOURCE' }]);
    expect(prisma.item.findMany).toHaveBeenCalledWith({ where: { type: 'RESOURCE' } });
  });

  describe('gather', () => {
    it('throw si ressource inexistante', async () => {
      prisma.item.findUnique.mockResolvedValue(null);
      await expect(service.gather('unknown', 'p1')).rejects.toThrow(/introuvable/);
    });

    it('hors session: crée inventoryItem si inexistant', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'wood' });
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({ id: 'new' });

      await service.gather('wood', 'p1');
      expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
        data: { playerId: 'p1', itemId: 'wood', quantity: 1, rank: 1 },
        include: { item: true },
      });
    });

    it('hors session: increment si inventoryItem existant', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'wood' });
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'inv-1' });
      prisma.inventoryItem.update.mockResolvedValue({ id: 'inv-1' });

      await service.gather('wood', 'p1');
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: { increment: 1 } },
        include: { item: true },
      });
    });

    it('en session: crée sessionItem', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'wood' });
      gameSession.getActiveSession.mockResolvedValue({ id: 'gs-1' });
      prisma.sessionItem.findUnique.mockResolvedValue(null);
      prisma.sessionItem.create.mockResolvedValue({ id: 'si-new' });

      await service.gather('wood', 'p1');
      expect(prisma.sessionItem.create).toHaveBeenCalled();
    });

    it('en session: increment sessionItem existant', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'wood' });
      gameSession.getActiveSession.mockResolvedValue({ id: 'gs-1' });
      prisma.sessionItem.findUnique.mockResolvedValue({ id: 'si-1' });

      await service.gather('wood', 'p1');
      expect(prisma.sessionItem.update).toHaveBeenCalledWith({
        where: { id: 'si-1' },
        data: { quantity: { increment: 1 } },
        include: { item: true },
      });
    });
  });
});

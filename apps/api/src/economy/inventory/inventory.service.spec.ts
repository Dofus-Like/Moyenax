import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const prisma = {
    sessionItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    item: {
      findFirst: jest.fn(),
    },
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const gameSession = {
    getActiveSession: jest.fn(),
  };

  let service: InventoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InventoryService(prisma as any, eventEmitter as any, gameSession as any);
  });

  it('returns only unequipped session items during an active session', async () => {
    gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
    prisma.sessionItem.findMany.mockResolvedValue([{ id: 'session-item-1' }]);

    await expect(service.findByPlayer('player-1')).resolves.toEqual([{ id: 'session-item-1' }]);

    expect(prisma.sessionItem.findMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'session-1',
        playerId: 'player-1',
        equipmentSlot: { is: null },
      },
      include: { item: true },
    });
    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
  });

  it('returns only unequipped persistent inventory items outside a session', async () => {
    gameSession.getActiveSession.mockResolvedValue(null);
    prisma.inventoryItem.findMany.mockResolvedValue([{ id: 'inventory-item-1' }]);

    await expect(service.findByPlayer('player-1')).resolves.toEqual([{ id: 'inventory-item-1' }]);

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({
      where: {
        playerId: 'player-1',
        equipmentSlot: { is: null },
      },
      include: { item: true },
    });
    expect(prisma.sessionItem.findMany).not.toHaveBeenCalled();
  });
});

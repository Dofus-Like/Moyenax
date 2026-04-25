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

  describe('equip', () => {
    it('equips a session item and emits ITEM_EQUIPPED event', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findUnique.mockResolvedValue({ id: 'si-1' });
      prisma.sessionItem.update.mockResolvedValue({ id: 'si-1', equipped: true, item: {} });

      const result = await service.equip('player-1', 'item-1');

      expect(result).toEqual({ id: 'si-1', equipped: true, item: {} });
      expect(prisma.sessionItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { equipped: true }, include: { item: true } }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('player.item.equipped', {
        playerId: 'player-1',
        itemId: 'item-1',
      });
    });

    it('throws NotFoundException when no active session', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);

      await expect(service.equip('player-1', 'item-1')).rejects.toThrow('Pas de session de jeu active');
    });

    it('throws NotFoundException when session item does not exist', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findUnique.mockResolvedValue(null);

      await expect(service.equip('player-1', 'item-1')).rejects.toThrow('Item non trouvé');
    });
  });

  describe('unequip', () => {
    it('unequips a session item and emits ITEM_UNEQUIPPED event', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findUnique.mockResolvedValue({ id: 'si-1' });
      prisma.sessionItem.update.mockResolvedValue({ id: 'si-1', equipped: false, item: {} });

      const result = await service.unequip('player-1', 'item-1');

      expect(result).toEqual({ id: 'si-1', equipped: false, item: {} });
      expect(prisma.sessionItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { equipped: false }, include: { item: true } }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('player.item.unequipped', {
        playerId: 'player-1',
        itemId: 'item-1',
      });
    });

    it('throws NotFoundException when no active session', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);

      await expect(service.unequip('player-1', 'item-1')).rejects.toThrow('Pas de session de jeu active');
    });

    it('throws NotFoundException when session item not found', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findUnique.mockResolvedValue(null);

      await expect(service.unequip('player-1', 'item-1')).rejects.toThrow('Item non trouvé');
    });
  });

  describe('addResourceByName', () => {
    it('throws NotFoundException when the item name does not exist', async () => {
      prisma.item.findFirst.mockResolvedValue(null);

      await expect(service.addResourceByName('player-1', 'Inexistant')).rejects.toThrow(
        'Ressource introuvable: Inexistant',
      );
    });

    it('increments existing inventory item when no active session', async () => {
      prisma.item.findFirst.mockResolvedValue({ id: 'item-bois' });
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'inv-1', quantity: 2 });
      prisma.inventoryItem.update.mockResolvedValue({ id: 'inv-1', quantity: 3 });

      const result = await service.addResourceByName('player-1', 'Bois');

      expect(result).toEqual({ id: 'inv-1', quantity: 3 });
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: { increment: 1 } },
      });
    });

    it('creates a new inventory item when no active session and no existing item', async () => {
      prisma.item.findFirst.mockResolvedValue({ id: 'item-bois' });
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({ id: 'inv-new', quantity: 1 });

      const result = await service.addResourceByName('player-1', 'Bois');

      expect(result).toEqual({ id: 'inv-new', quantity: 1 });
      expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
        data: { playerId: 'player-1', itemId: 'item-bois', quantity: 1, rank: 1 },
      });
    });

    it('increments existing session item during active session', async () => {
      prisma.item.findFirst.mockResolvedValue({ id: 'item-bois' });
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findUnique.mockResolvedValue({ id: 'si-1', quantity: 1 });
      prisma.sessionItem.update.mockResolvedValue({ id: 'si-1', quantity: 2 });

      const result = await service.addResourceByName('player-1', 'Bois');

      expect(result).toEqual({ id: 'si-1', quantity: 2 });
      expect(prisma.sessionItem.update).toHaveBeenCalledWith({
        where: { id: 'si-1' },
        data: { quantity: { increment: 1 } },
      });
    });

    it('creates a new session item when none exists during active session', async () => {
      prisma.item.findFirst.mockResolvedValue({ id: 'item-bois' });
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findUnique.mockResolvedValue(null);
      prisma.sessionItem.create.mockResolvedValue({ id: 'si-new', quantity: 1 });

      const result = await service.addResourceByName('player-1', 'Bois');

      expect(result).toEqual({ id: 'si-new', quantity: 1 });
      expect(prisma.sessionItem.create).toHaveBeenCalledWith({
        data: { sessionId: 'session-1', playerId: 'player-1', itemId: 'item-bois', quantity: 1 },
      });
    });
  });
});

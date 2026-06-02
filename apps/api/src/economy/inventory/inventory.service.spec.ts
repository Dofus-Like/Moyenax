import { ItemType } from '@game/shared-types';

import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const prisma = {
    sessionItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    item: {
      findFirst: jest.fn(),
    },
    playerStats: {
      update: jest.fn(),
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
      prisma.sessionItem.findFirst.mockResolvedValue({ id: 'si-1' });
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
      prisma.sessionItem.findFirst.mockResolvedValue(null);

      await expect(service.equip('player-1', 'item-1')).rejects.toThrow('Item non trouvé');
    });
  });

  describe('unequip', () => {
    it('unequips a session item and emits ITEM_UNEQUIPPED event', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findFirst.mockResolvedValue({ id: 'si-1' });
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
      prisma.sessionItem.findFirst.mockResolvedValue(null);

      await expect(service.unequip('player-1', 'item-1')).rejects.toThrow('Item non trouvé');
    });
  });

  describe('useItem', () => {
    const consumableDef = {
      id: 'item-potion',
      name: 'Potion de soin',
      type: ItemType.CONSUMABLE,
      statsBonus: { healVit: 10, buffAttaque: 5 },
    };

    const nonConsumableDef = {
      id: 'item-sword',
      name: 'Épée',
      type: ItemType.WEAPON,
      statsBonus: null,
    };

    const noBonusConsumableDef = {
      id: 'item-nobonus',
      name: 'Eau',
      type: ItemType.CONSUMABLE,
      statsBonus: null,
    };

    const unknownBonusDef = {
      id: 'item-unknown',
      name: 'Mystery',
      type: ItemType.CONSUMABLE,
      statsBonus: { unknownField: 99 },
    };

    it('consumes a session CONSUMABLE with quantity > 1, increments playerStats and decrements quantity', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findFirst.mockResolvedValue({
        id: 'si-1',
        quantity: 3,
        item: consumableDef,
      });
      prisma.playerStats.update.mockResolvedValue({});
      prisma.sessionItem.update.mockResolvedValue({ id: 'si-1', quantity: 2, item: consumableDef });
      prisma.sessionItem.findMany.mockResolvedValue([{ id: 'si-1', quantity: 2 }]);

      const result = await service.useItem('player-1', 'item-potion');

      expect(prisma.playerStats.update).toHaveBeenCalledWith({
        where: { playerId: 'player-1' },
        data: expect.objectContaining({
          vit: { increment: 10 },
          baseVit: { increment: 10 },
          atk: { increment: 5 },
          baseAtk: { increment: 5 },
        }),
      });
      expect(prisma.sessionItem.update).toHaveBeenCalledWith({
        where: { id: 'si-1' },
        data: { quantity: { decrement: 1 } },
      });
      expect(prisma.sessionItem.delete).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 'si-1', quantity: 2 }]);
    });

    it('consumes a session CONSUMABLE with quantity === 1, deletes the record', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findFirst.mockResolvedValue({
        id: 'si-1',
        quantity: 1,
        item: consumableDef,
      });
      prisma.playerStats.update.mockResolvedValue({});
      prisma.sessionItem.delete.mockResolvedValue({});
      prisma.sessionItem.findMany.mockResolvedValue([]);

      await service.useItem('player-1', 'item-potion');

      expect(prisma.playerStats.update).toHaveBeenCalled();
      expect(prisma.sessionItem.delete).toHaveBeenCalledWith({
        where: { id: 'si-1' },
      });
      expect(prisma.sessionItem.update).not.toHaveBeenCalled();
    });

    it('consumes a persistent inventory CONSUMABLE when no active session', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantity: 2,
        item: consumableDef,
      });
      prisma.playerStats.update.mockResolvedValue({});
      prisma.inventoryItem.update.mockResolvedValue({ id: 'inv-1', quantity: 1, item: consumableDef });
      prisma.inventoryItem.findMany.mockResolvedValue([{ id: 'inv-1', quantity: 1 }]);

      const result = await service.useItem('player-1', 'item-potion');

      expect(prisma.playerStats.update).toHaveBeenCalled();
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: { decrement: 1 } },
      });
      expect(result).toEqual([{ id: 'inv-1', quantity: 1 }]);
    });

    it('throws NotFoundException when the item is not in inventory', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findFirst.mockResolvedValue(null);

      await expect(service.useItem('player-1', 'item-potion')).rejects.toThrow('Objet introuvable');
    });

    it('throws BadRequestException when item is not CONSUMABLE', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findFirst.mockResolvedValue({
        id: 'si-sword',
        quantity: 1,
        item: nonConsumableDef,
      });

      await expect(service.useItem('player-1', 'item-sword')).rejects.toThrow('ne peut pas être consommé');
    });

    it('throws BadRequestException when item has no statsBonus', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findFirst.mockResolvedValue({
        id: 'si-nobonus',
        quantity: 1,
        item: noBonusConsumableDef,
      });

      await expect(service.useItem('player-1', 'item-nobonus')).rejects.toThrow("n'a aucun effet");
    });

    it('throws BadRequestException when bonus keys are not recognized', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });
      prisma.sessionItem.findFirst.mockResolvedValue({
        id: 'si-unknown',
        quantity: 1,
        item: unknownBonusDef,
      });

      await expect(service.useItem('player-1', 'item-unknown')).rejects.toThrow('Bonus');
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
      prisma.sessionItem.findFirst.mockResolvedValue({ id: 'si-1', quantity: 1 });
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
      prisma.sessionItem.findFirst.mockResolvedValue(null);
      prisma.sessionItem.create.mockResolvedValue({ id: 'si-new', quantity: 1 });

      const result = await service.addResourceByName('player-1', 'Bois');

      expect(result).toEqual({ id: 'si-new', quantity: 1 });
      expect(prisma.sessionItem.create).toHaveBeenCalledWith({
        data: { sessionId: 'session-1', playerId: 'player-1', itemId: 'item-bois', quantity: 1 },
      });
    });
  });
});

import { CraftingService } from './crafting.service';

describe('CraftingService', () => {
  const tx = {
    inventoryItem: {
      findFirst: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    sessionItem: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const prisma = {
    item: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryItem: {
      findUnique: jest.fn(),
    },
    equipmentSlot: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const gameSession = {
    getActiveSession: jest.fn(),
  };

  const spendableGold = {
    debitOrThrowInTransaction: jest.fn(),
  };

  let service: CraftingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    spendableGold.debitOrThrowInTransaction.mockResolvedValue(0);
    service = new CraftingService(prisma as any, gameSession as any, spendableGold as any);
  });

  it('uses the player wallet for Or costs outside a session', async () => {
    prisma.item.findUnique.mockResolvedValue({
      id: 'crafted-item',
      craftCost: {
        'iron-item': 2,
        'gold-item': 3,
      },
    });
    prisma.item.findMany.mockResolvedValue([
      { id: 'iron-item', name: 'Fer' },
      { id: 'gold-item', name: 'Or' },
    ]);
    gameSession.getActiveSession.mockResolvedValue(null);
    tx.inventoryItem.findFirst
      .mockResolvedValueOnce({ id: 'inv-iron', quantity: 2 })
      .mockResolvedValueOnce({ id: 'inv-iron', quantity: 2 });
    tx.inventoryItem.findUnique.mockResolvedValue(null);
    tx.inventoryItem.create.mockResolvedValue({ id: 'crafted-row' });

    await service.craft('player-1', 'crafted-item');

    expect(spendableGold.debitOrThrowInTransaction).toHaveBeenCalledWith(
      tx,
      'player-1',
      3,
      null,
      'Or insuffisant pour le craft',
    );
    expect(tx.inventoryItem.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.inventoryItem.create).toHaveBeenCalledWith({
      data: { playerId: 'player-1', itemId: 'crafted-item', quantity: 1, rank: 1 },
      include: { item: true },
    });
  });

  it('uses the session wallet for Or costs during a game session', async () => {
    const session = {
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
      player1Po: 5,
      player2Po: 0,
    };

    prisma.item.findUnique.mockResolvedValue({
      id: 'crafted-item',
      craftCost: {
        'iron-item': 1,
        'gold-item': 2,
      },
    });
    prisma.item.findMany.mockResolvedValue([
      { id: 'iron-item', name: 'Fer' },
      { id: 'gold-item', name: 'Or' },
    ]);
    gameSession.getActiveSession.mockResolvedValue(session);
    tx.sessionItem.findUnique
      .mockResolvedValueOnce({ id: 'session-iron', quantity: 1 })
      .mockResolvedValueOnce({ id: 'session-iron', quantity: 1 })
      .mockResolvedValueOnce(null);
    tx.sessionItem.create.mockResolvedValue({ id: 'crafted-session-row' });

    await service.craft('player-1', 'crafted-item');

    expect(spendableGold.debitOrThrowInTransaction).toHaveBeenCalledWith(
      tx,
      'player-1',
      2,
      session,
      'Pièces insuffisantes pour le craft',
    );
    expect(tx.sessionItem.create).toHaveBeenCalledWith({
      data: { sessionId: 'session-1', playerId: 'player-1', itemId: 'crafted-item', quantity: 1 },
      include: { item: true },
    });
  });

  describe('getRecipes', () => {
    it('returns only items that have a craftCost', async () => {
      prisma.item.findMany.mockResolvedValue([
        { id: 'item-1', craftCost: { 'mat-1': 2 } },
        { id: 'item-2', craftCost: null },
        { id: 'item-3', craftCost: { 'mat-2': 1 } },
      ]);

      const recipes = await service.getRecipes();

      expect(recipes).toHaveLength(2);
      expect(recipes.map((r) => r.id)).toEqual(['item-1', 'item-3']);
    });

    it('returns empty array when no items have a craftCost', async () => {
      prisma.item.findMany.mockResolvedValue([{ id: 'item-1', craftCost: null }]);

      await expect(service.getRecipes()).resolves.toEqual([]);
    });
  });

  describe('craft - error paths', () => {
    it('throws NotFoundException when item does not exist', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(service.craft('player-1', 'missing-item')).rejects.toThrow('Recette introuvable');
    });

    it('throws NotFoundException when item has no craftCost', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'item-1', craftCost: null });

      await expect(service.craft('player-1', 'item-1')).rejects.toThrow('Recette introuvable');
    });

    it('throws BadRequestException when resource quantity is insufficient outside session', async () => {
      prisma.item.findUnique.mockResolvedValue({
        id: 'crafted-item',
        craftCost: { 'iron-item': 3 },
      });
      prisma.item.findMany.mockResolvedValue([{ id: 'iron-item', name: 'Fer' }]);
      gameSession.getActiveSession.mockResolvedValue(null);
      tx.inventoryItem.findFirst.mockResolvedValue({ id: 'inv-iron', quantity: 1 });

      await expect(service.craft('player-1', 'crafted-item')).rejects.toThrow(
        'Ressource insuffisante pour le craft',
      );
    });

    it('increments existing crafted item stack outside session', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'crafted-item', craftCost: { 'gold-item': 2 } });
      prisma.item.findMany.mockResolvedValue([{ id: 'gold-item', name: 'Or' }]);
      gameSession.getActiveSession.mockResolvedValue(null);
      tx.inventoryItem.findUnique.mockResolvedValue({ id: 'existing-crafted', quantity: 1 });
      tx.inventoryItem.update.mockResolvedValue({ id: 'existing-crafted', quantity: 2 });

      const result = await service.craft('player-1', 'crafted-item');

      expect(result).toEqual({ id: 'existing-crafted', quantity: 2 });
      expect(tx.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: { increment: 1 } } }),
      );
    });

    it('deletes an inventory resource row when the last unit is consumed', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'crafted-item', craftCost: { 'iron-item': 2 } });
      prisma.item.findMany.mockResolvedValue([{ id: 'iron-item', name: 'Fer' }]);
      gameSession.getActiveSession.mockResolvedValue(null);
      tx.inventoryItem.findFirst
        .mockResolvedValueOnce({ id: 'inv-iron', quantity: 2 })
        .mockResolvedValueOnce({ id: 'inv-iron', quantity: 2 });
      tx.inventoryItem.findUnique.mockResolvedValue(null);
      tx.inventoryItem.create.mockResolvedValue({ id: 'crafted-row' });

      await service.craft('player-1', 'crafted-item');

      expect(tx.inventoryItem.delete).toHaveBeenCalledWith({ where: { id: 'inv-iron' } });
    });
  });

  describe('merge', () => {
    it('throws BadRequestException when inside an active session', async () => {
      gameSession.getActiveSession.mockResolvedValue({ id: 'session-1' });

      await expect(service.merge('player-1', 'item-1', 1)).rejects.toThrow(
        "La fusion d'objets n'est pas disponible pendant une session de jeu pour l'instant",
      );
    });

    it('throws BadRequestException when item is already at max rank (3)', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);

      await expect(service.merge('player-1', 'item-1', 3)).rejects.toThrow(
        'Rang maximum déjà atteint',
      );
    });

    it('throws BadRequestException when inventory item not found or insufficient quantity', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findUnique.mockResolvedValue(null);

      await expect(service.merge('player-1', 'item-1', 1)).rejects.toThrow(
        'Quantité insuffisante pour la fusion',
      );
    });

    it('throws BadRequestException when item is equipped', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'inv-1', quantity: 2, rank: 1 });
      prisma.equipmentSlot.findFirst.mockResolvedValue({ id: 'slot-1' });

      await expect(service.merge('player-1', 'item-1', 1)).rejects.toThrow(
        'Impossible de fusionner un objet équipé',
      );
    });

    it('deletes the source row and creates a rank+1 item when quantity is exactly 2', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'inv-1', quantity: 2, rank: 1 });
      prisma.equipmentSlot.findFirst.mockResolvedValue(null);
      tx.inventoryItem.findUnique.mockResolvedValue(null);
      tx.inventoryItem.create.mockResolvedValue({ id: 'rank2-item', rank: 2, quantity: 1 });

      const result = await service.merge('player-1', 'item-1', 1);

      expect(result).toEqual({ id: 'rank2-item', rank: 2, quantity: 1 });
      expect(tx.inventoryItem.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
      expect(tx.inventoryItem.create).toHaveBeenCalledWith({
        data: { playerId: 'player-1', itemId: 'item-1', quantity: 1, rank: 2 },
        include: { item: true },
      });
    });

    it('decrements by 2 and increments existing rank+1 item when quantity exceeds 2', async () => {
      gameSession.getActiveSession.mockResolvedValue(null);
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'inv-1', quantity: 4, rank: 1 });
      prisma.equipmentSlot.findFirst.mockResolvedValue(null);
      tx.inventoryItem.findUnique.mockResolvedValue({ id: 'rank2-existing', quantity: 1 });
      tx.inventoryItem.update.mockResolvedValue({ id: 'rank2-existing', quantity: 2 });

      const result = await service.merge('player-1', 'item-1', 1);

      expect(tx.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: { decrement: 2 } } }),
      );
      expect(result).toEqual({ id: 'rank2-existing', quantity: 2 });
    });
  });
});

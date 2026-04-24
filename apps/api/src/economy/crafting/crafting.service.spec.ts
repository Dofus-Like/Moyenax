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
});

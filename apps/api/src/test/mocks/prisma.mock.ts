export type PrismaMock = {
  player: Record<string, jest.Mock>;
  playerStats: Record<string, jest.Mock>;
  combatSession: Record<string, jest.Mock>;
  combatTurn: Record<string, jest.Mock>;
  gameSession: Record<string, jest.Mock>;
  sessionItem: Record<string, jest.Mock>;
  equipmentSlot: Record<string, jest.Mock>;
  inventoryItem: Record<string, jest.Mock>;
  item: Record<string, jest.Mock>;
  spell: Record<string, jest.Mock>;
  playerSpell: Record<string, jest.Mock>;
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

export function makePrismaMock(): PrismaMock {
  const crud = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  });

  return {
    player: crud(),
    playerStats: crud(),
    combatSession: crud(),
    combatTurn: crud(),
    gameSession: crud(),
    sessionItem: crud(),
    equipmentSlot: crud(),
    inventoryItem: crud(),
    item: crud(),
    spell: crud(),
    playerSpell: crud(),
    $transaction: jest.fn((cb) => (typeof cb === 'function' ? cb(this) : Promise.all(cb))),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}

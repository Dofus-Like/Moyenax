import { SpellEffectKind, SpellFamily, SpellType, SpellVisualType } from '@game/shared-types';

import { PlayerSpellProjectionService } from './player-spell-projection.service';

const defaultSpell = {
  id: 'spell-claque-id',
  code: 'spell-claque',
  name: 'Claque',
  description: 'Une gifle universelle.',
  paCost: 2,
  minRange: 1,
  maxRange: 1,
  damageMin: 8,
  damageMax: 12,
  cooldown: 0,
  type: 'DAMAGE',
  visualType: 'PHYSICAL',
  family: 'COMMON',
  iconPath: '/assets/pack/spells/epee.png',
  sortOrder: 99,
  requiresLineOfSight: true,
  requiresLinearTargeting: false,
  effectKind: 'DAMAGE_PHYSICAL',
  effectConfig: {},
  isDefault: true,
};

const warriorSpellRows = [
  {
    ...defaultSpell,
    id: 'spell-frappe-id',
    code: 'spell-frappe',
    name: 'Frappe',
    damageMin: 35,
    damageMax: 45,
    family: 'WARRIOR',
    sortOrder: 10,
    isDefault: false,
  },
  {
    ...defaultSpell,
    id: 'spell-bond-id',
    code: 'spell-bond',
    name: 'Bond',
    damageMin: 0,
    damageMax: 0,
    paCost: 4,
    maxRange: 4,
    cooldown: 1,
    type: 'BUFF',
    visualType: 'UTILITY',
    family: 'WARRIOR',
    sortOrder: 11,
    requiresLineOfSight: false,
    effectKind: 'TELEPORT',
    isDefault: false,
  },
  {
    ...defaultSpell,
    id: 'spell-endurance-id',
    code: 'spell-endurance',
    name: 'Endurance',
    damageMin: 0,
    damageMax: 0,
    paCost: 2,
    minRange: 0,
    maxRange: 0,
    cooldown: 2,
    type: 'BUFF',
    visualType: 'UTILITY',
    family: 'WARRIOR',
    sortOrder: 12,
    effectKind: 'BUFF_VIT_MAX',
    effectConfig: { buffValue: 20, buffDuration: 99 },
    isDefault: false,
  },
];

describe('PlayerSpellProjectionService', () => {
  const prisma = {
    equipmentSlot: {
      findMany: jest.fn(),
    },
    spell: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    playerSpell: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    itemGrantedSpell: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const spellResolver = {
    resolveSpells: jest.fn(),
  };

  let service: PlayerSpellProjectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (operations: any[]) => Promise.all(operations));
    service = new PlayerSpellProjectionService(prisma as any, spellResolver as any);
  });

  it('assigns spells using the spellResolver', async () => {
    prisma.equipmentSlot.findMany.mockResolvedValue([]);
    prisma.spell.findMany.mockResolvedValue([defaultSpell]);
    prisma.itemGrantedSpell.findMany.mockResolvedValue([]);

    spellResolver.resolveSpells.mockReturnValue({
      'spell-claque-id': 1,
    });

    await expect(service.buildPlayerSpellAssignments('player-1')).resolves.toEqual([
      { playerId: 'player-1', spellId: 'spell-claque-id', level: 1 },
    ]);
  });

  it('maps DB spell rows to combat definitions exposed to the combat state', async () => {
    prisma.playerSpell.findMany.mockResolvedValue([
      { spell: defaultSpell },
      { spell: warriorSpellRows[1] },
    ]);

    await expect(service.getCombatSpellDefinitions('player-1')).resolves.toEqual([
      {
        id: 'spell-bond',
        code: 'spell-bond',
        name: 'Bond',
        description: 'Une gifle universelle.', // In our mock it inherits from defaultSpell
        paCost: 4,
        minRange: 1,
        maxRange: 4,
        damage: { min: 0, max: 0 },
        cooldown: 1,
        type: SpellType.BUFF,
        visualType: SpellVisualType.UTILITY,
        family: SpellFamily.WARRIOR,
        iconPath: '/assets/pack/spells/epee.png',
        sortOrder: 11,
        requiresLineOfSight: false,
        requiresLinearTargeting: false,
        effectKind: SpellEffectKind.TELEPORT,
        effectConfig: {},
      },
      {
        id: 'spell-claque',
        code: 'spell-claque',
        name: 'Claque',
        description: 'Une gifle universelle.',
        paCost: 2,
        minRange: 1,
        maxRange: 1,
        damage: { min: 8, max: 12 },
        cooldown: 0,
        type: SpellType.DAMAGE,
        visualType: SpellVisualType.PHYSICAL,
        family: SpellFamily.COMMON,
        iconPath: '/assets/pack/spells/epee.png',
        sortOrder: 99,
        requiresLineOfSight: true,
        requiresLinearTargeting: false,
        effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
        effectConfig: {},
      },
    ]);
  });

  it('triggers syncPlayerSpells and retries findMany when playerSpells is empty', async () => {
    prisma.playerSpell.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ spell: defaultSpell }]);

    prisma.equipmentSlot.findMany.mockResolvedValue([]);
    prisma.spell.findMany.mockResolvedValue([defaultSpell]);
    prisma.itemGrantedSpell.findMany.mockResolvedValue([]);
    spellResolver.resolveSpells.mockReturnValue({ 'spell-claque-id': 1 });
    prisma.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));

    const result = await service.getCombatSpellDefinitions('player-1');

    expect(prisma.playerSpell.findMany).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('spell-claque');
  });

  it('syncPlayerSpells deletes all then inserts computed assignments', async () => {
    prisma.equipmentSlot.findMany.mockResolvedValue([]);
    prisma.spell.findMany.mockResolvedValue([defaultSpell]);
    prisma.itemGrantedSpell.findMany.mockResolvedValue([]);
    spellResolver.resolveSpells.mockReturnValue({ 'spell-claque-id': 1 });
    prisma.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));

    const assignments = await service.syncPlayerSpells('player-1');

    expect(prisma.playerSpell.deleteMany).toHaveBeenCalledWith({ where: { playerId: 'player-1' } });
    expect(prisma.playerSpell.createMany).toHaveBeenCalledWith({
      data: [{ playerId: 'player-1', spellId: 'spell-claque-id', level: 1 }],
    });
    expect(assignments).toEqual([{ playerId: 'player-1', spellId: 'spell-claque-id', level: 1 }]);
  });

  it('syncPlayerSpells skips createMany when no spells are resolved', async () => {
    prisma.equipmentSlot.findMany.mockResolvedValue([]);
    prisma.spell.findMany.mockResolvedValue([]);
    prisma.itemGrantedSpell.findMany.mockResolvedValue([]);
    spellResolver.resolveSpells.mockReturnValue({});
    prisma.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));

    const assignments = await service.syncPlayerSpells('player-1');

    expect(prisma.playerSpell.createMany).not.toHaveBeenCalled();
    expect(assignments).toEqual([]);
  });

  it('caps spell level at 3 even if the source count is higher', async () => {
    prisma.equipmentSlot.findMany.mockResolvedValue([]);
    prisma.spell.findMany.mockResolvedValue([defaultSpell]);
    prisma.itemGrantedSpell.findMany.mockResolvedValue([]);
    spellResolver.resolveSpells.mockReturnValue({ 'spell-claque-id': 10 });

    const assignments = await service.buildPlayerSpellAssignments('player-1');

    expect(assignments[0].level).toBe(3);
  });

  it('toCombatDefinition maps null effectConfig to null', async () => {
    prisma.playerSpell.findMany.mockResolvedValue([
      { spell: { ...defaultSpell, effectConfig: null } },
    ]);

    const result = await service.getCombatSpellDefinitions('player-1');

    expect(result[0].effectConfig).toBeNull();
  });

  it('returns empty array when no spells are assigned after sync', async () => {
    prisma.playerSpell.findMany.mockResolvedValue([]);

    prisma.equipmentSlot.findMany.mockResolvedValue([]);
    prisma.spell.findMany.mockResolvedValue([]);
    prisma.itemGrantedSpell.findMany.mockResolvedValue([]);
    spellResolver.resolveSpells.mockReturnValue({});
    prisma.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));

    const result = await service.getCombatSpellDefinitions('player-1');

    expect(result).toEqual([]);
  });
});

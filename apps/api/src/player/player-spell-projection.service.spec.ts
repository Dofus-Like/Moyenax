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
    // Mock the chain of calls for getCombatSpellDefinitions -> getProjectedSpellRows -> getSpellSources
    prisma.equipmentSlot.findMany.mockResolvedValue([]);
    prisma.spell.findMany
      .mockResolvedValueOnce([defaultSpell]) // isDefault: true
      .mockResolvedValueOnce([]) // grants
      .mockResolvedValueOnce([defaultSpell, warriorSpellRows[1]]); // allSpells
    prisma.itemGrantedSpell.findMany.mockResolvedValue([]);

    spellResolver.resolveSpells.mockReturnValue({
      'spell-claque-id': 1,
      'spell-bond-id': 1,
    });

    await expect(service.getCombatSpellDefinitions('player-1')).resolves.toEqual([
      {
        id: 'spell-bond',
        code: 'spell-bond',
        name: 'Bond',
        description: 'Une gifle universelle.',
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
});

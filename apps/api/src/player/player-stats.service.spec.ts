import { Test, TestingModule } from '@nestjs/testing';
import { PlayerStatsService } from './player-stats.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { StatsCalculatorService } from './stats-calculator.service';

describe('PlayerStatsService', () => {
  let service: PlayerStatsService;
  let prisma: {
    playerStats: { findUnique: jest.Mock };
    equipmentSlot: { findMany: jest.Mock };
  };
  let calculator: { computeEffectiveStatsFromSnapshot: jest.Mock };

  const baseStatsRow = {
    playerId: 'p1',
    baseVit: 100,
    baseAtk: 10,
    baseMag: 10,
    baseDef: 5,
    baseRes: 5,
    baseIni: 20,
    basePa: 6,
    basePm: 3,
  };

  beforeEach(async () => {
    prisma = {
      playerStats: { findUnique: jest.fn() },
      equipmentSlot: { findMany: jest.fn() },
    };
    calculator = {
      computeEffectiveStatsFromSnapshot: jest.fn().mockImplementation((base) => ({
        ...base,
        vit: base.baseVit,
        atk: base.baseAtk,
        mag: base.baseMag,
        def: base.baseDef,
        res: base.baseRes,
        ini: base.baseIni,
        pa: base.basePa,
        pm: base.basePm,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerStatsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StatsCalculatorService, useValue: calculator },
      ],
    }).compile();

    service = module.get(PlayerStatsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getCombatLoadout', () => {
    it('throw si baseStats introuvables', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(null);
      prisma.equipmentSlot.findMany.mockResolvedValue([]);
      await expect(service.getCombatLoadout('p1')).rejects.toThrow('Stats de base');
    });

    it('retourne items + stats', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(baseStatsRow);
      prisma.equipmentSlot.findMany.mockResolvedValue([
        {
          inventoryItem: {
            item: {
              id: 'item-1',
              name: 'Sword',
              description: null,
              type: 'WEAPON',
              family: null,
              statsBonus: { atk: 5 },
              grantsSpells: null,
              craftCost: null,
              shopPrice: 100,
              rank: 1,
            },
          },
        },
      ]);

      const result = await service.getCombatLoadout('p1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('item-1');
      expect(result.stats).toBeDefined();
      expect(calculator.computeEffectiveStatsFromSnapshot).toHaveBeenCalled();
    });

    it('filtre les slots avec item=null', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(baseStatsRow);
      prisma.equipmentSlot.findMany.mockResolvedValue([
        { inventoryItem: null, sessionItem: null },
        { inventoryItem: { item: { id: 'x', name: 'X', type: 'WEAPON' } } },
      ]);
      const result = await service.getCombatLoadout('p1');
      expect(result.items).toHaveLength(1);
    });

    it('utilise sessionItem si inventoryItem vide', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(baseStatsRow);
      prisma.equipmentSlot.findMany.mockResolvedValue([
        { inventoryItem: null, sessionItem: { item: { id: 's1', name: 'Session', type: 'ARMOR_HEAD' } } },
      ]);
      const result = await service.getCombatLoadout('p1');
      expect(result.items[0].id).toBe('s1');
    });
  });

  describe('getEffectiveStats', () => {
    it('délègue à getCombatLoadout et retourne .stats', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(baseStatsRow);
      prisma.equipmentSlot.findMany.mockResolvedValue([]);
      const result = await service.getEffectiveStats('p1');
      expect(result.vit).toBe(100);
    });
  });

  describe('getEquippedItems', () => {
    it('retourne la liste mappée d\'items équipés', async () => {
      prisma.equipmentSlot.findMany.mockResolvedValue([
        {
          inventoryItem: {
            item: { id: 'i1', name: 'I1', type: 'WEAPON', statsBonus: null, grantsSpells: null, craftCost: null, shopPrice: null, rank: 1, description: null, family: null },
          },
        },
        { inventoryItem: null, sessionItem: null },
      ]);
      const result = await service.getEquippedItems('p1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('i1');
    });
  });
});

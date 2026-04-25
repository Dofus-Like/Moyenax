import { Test, TestingModule } from '@nestjs/testing';
import { StatsCalculatorService } from './stats-calculator.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { PerfLoggerService } from '../shared/perf/perf-logger.service';

describe('StatsCalculatorService', () => {
  let service: StatsCalculatorService;
  let prisma: {
    playerStats: { findUnique: jest.Mock };
    equipmentSlot: { findMany: jest.Mock };
  };

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsCalculatorService,
        { provide: PrismaService, useValue: prisma },
        { provide: PerfLoggerService, useValue: { logDuration: jest.fn() } },
      ],
    }).compile();

    service = module.get(StatsCalculatorService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('computeEffectiveStats', () => {
    it('throw si pas de stats de base', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(null);
      prisma.equipmentSlot.findMany.mockResolvedValue([]);
      await expect(service.computeEffectiveStats('p1')).rejects.toThrow('Stats de base');
    });

    it('retourne les stats de base sans équipement', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(baseStatsRow);
      prisma.equipmentSlot.findMany.mockResolvedValue([]);
      const result = await service.computeEffectiveStats('p1');
      expect(result.vit).toBe(100);
      expect(result.atk).toBe(10);
      expect(result.baseVit).toBe(100);
    });

    it('ajoute les bonus d\'items équipés (inventoryItem)', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(baseStatsRow);
      prisma.equipmentSlot.findMany.mockResolvedValue([
        {
          inventoryItem: { rank: 1, item: { statsBonus: { atk: 15 } } },
          sessionItem: null,
        },
      ]);
      const result = await service.computeEffectiveStats('p1');
      expect(result.atk).toBe(25); // 10 + 15*1
    });

    it('utilise sessionItem si inventoryItem est null', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(baseStatsRow);
      prisma.equipmentSlot.findMany.mockResolvedValue([
        {
          inventoryItem: null,
          sessionItem: { item: { statsBonus: { def: 20 } } },
        },
      ]);
      const result = await service.computeEffectiveStats('p1');
      expect(result.def).toBe(25); // 5 + 20*1 (sessionItems ont rank=1)
    });

    it('multiplie le bonus par le rang de l\'item', async () => {
      prisma.playerStats.findUnique.mockResolvedValue(baseStatsRow);
      prisma.equipmentSlot.findMany.mockResolvedValue([
        {
          inventoryItem: { rank: 3, item: { statsBonus: { atk: 10 } } },
          sessionItem: null,
        },
      ]);
      const result = await service.computeEffectiveStats('p1');
      expect(result.atk).toBe(40); // 10 + 10*3
    });
  });

  describe('computeEffectiveStatsFromSnapshot', () => {
    it('ignore les bonus qui ne sont pas dans PlayerStats', async () => {
      const result = service.computeEffectiveStatsFromSnapshot(baseStatsRow, [
        { inventoryItem: { rank: 1, item: { statsBonus: { atk: 5, unknownKey: 100 } } } } as never,
      ]);
      expect(result.atk).toBe(15);
      expect((result as unknown as Record<string, number>)['unknownKey']).toBeUndefined();
    });

    it('ignore les bonus non-numériques', async () => {
      const result = service.computeEffectiveStatsFromSnapshot(baseStatsRow, [
        { inventoryItem: { rank: 1, item: { statsBonus: { atk: 'invalid' } } } } as never,
      ]);
      expect(result.atk).toBe(10);
    });

    it('gère un item sans statsBonus', async () => {
      const result = service.computeEffectiveStatsFromSnapshot(baseStatsRow, [
        { inventoryItem: { rank: 1, item: { statsBonus: null } } } as never,
      ]);
      expect(result.atk).toBe(10);
    });

    it('gère un slot vide (inventoryItem=null, sessionItem=null)', async () => {
      const result = service.computeEffectiveStatsFromSnapshot(baseStatsRow, [
        { inventoryItem: null, sessionItem: null } as never,
      ]);
      expect(result.atk).toBe(10);
    });

    it('cumule plusieurs slots', async () => {
      const result = service.computeEffectiveStatsFromSnapshot(baseStatsRow, [
        { inventoryItem: { rank: 1, item: { statsBonus: { atk: 5 } } } } as never,
        { inventoryItem: { rank: 2, item: { statsBonus: { atk: 3, def: 10 } } } } as never,
        { sessionItem: { item: { statsBonus: { mag: 15 } } } } as never,
      ]);
      expect(result.atk).toBe(21); // 10 + 5 + 6
      expect(result.def).toBe(25); // 5 + 20
      expect(result.mag).toBe(25); // 10 + 15
    });

    it('préserve les stats de base dans le résultat', async () => {
      const result = service.computeEffectiveStatsFromSnapshot(baseStatsRow, [
        { inventoryItem: { rank: 1, item: { statsBonus: { atk: 50 } } } } as never,
      ]);
      expect(result.baseAtk).toBe(10); // inchangé
      expect(result.atk).toBe(60); // modifié
    });
  });
});

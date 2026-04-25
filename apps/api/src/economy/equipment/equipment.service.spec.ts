import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EquipmentSlotType, GAME_EVENTS } from '@game/shared-types';
import { EquipmentService } from './equipment.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StatsCalculatorService } from '../../player/stats-calculator.service';
import { PlayerSpellProjectionService } from '../../player/player-spell-projection.service';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { GameSessionService } from '../../game-session/game-session.service';

describe('EquipmentService', () => {
  let service: EquipmentService;
  let prisma: {
    equipmentSlot: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    inventoryItem: { findFirst: jest.Mock };
    sessionItem: { findFirst: jest.Mock };
    playerStats: { update: jest.Mock };
    playerSpell: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let statsCalc: { computeEffectiveStats: jest.Mock };
  let spells: { buildPlayerSpellAssignments: jest.Mock };
  let gameSession: { getActiveSession: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      equipmentSlot: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryItem: { findFirst: jest.fn() },
      sessionItem: { findFirst: jest.fn() },
      playerStats: { update: jest.fn() },
      playerSpell: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    statsCalc = { computeEffectiveStats: jest.fn().mockResolvedValue({ vit: 100 }) };
    spells = { buildPlayerSpellAssignments: jest.fn().mockResolvedValue([]) };
    gameSession = { getActiveSession: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: StatsCalculatorService, useValue: statsCalc },
        { provide: PlayerSpellProjectionService, useValue: spells },
        { provide: PerfLoggerService, useValue: { logDuration: jest.fn() } },
        { provide: GameSessionService, useValue: gameSession },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(EquipmentService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getEquipment', () => {
    it('retourne un objet avec toutes les EquipmentSlotType (valeur null si slot vide)', async () => {
      prisma.equipmentSlot.findMany.mockResolvedValue([]);
      const result = await service.getEquipment('p1');
      for (const slot of Object.values(EquipmentSlotType)) {
        expect(result).toHaveProperty(slot, null);
      }
    });

    it('retourne inventoryItem si équipé (inventoryItem a priorité)', async () => {
      prisma.equipmentSlot.findMany.mockResolvedValue([
        {
          slot: EquipmentSlotType.WEAPON_LEFT,
          inventoryItem: { id: 'inv-1', item: { id: 'i-1' } },
          sessionItem: null,
        },
      ]);
      const result = await service.getEquipment('p1');
      expect(result[EquipmentSlotType.WEAPON_LEFT]).toEqual({ id: 'inv-1', item: { id: 'i-1' } });
    });

    it('retourne sessionItem "wrappé" si pas d\'inventoryItem', async () => {
      prisma.equipmentSlot.findMany.mockResolvedValue([
        {
          slot: EquipmentSlotType.ARMOR_HEAD,
          inventoryItem: null,
          sessionItem: {
            id: 'si-1',
            playerId: 'p1',
            itemId: 'item-x',
            quantity: 1,
            item: { id: 'item-x', type: 'ARMOR_HEAD' },
          },
        },
      ]);
      const result = await service.getEquipment('p1');
      expect(result[EquipmentSlotType.ARMOR_HEAD]).toMatchObject({
        id: 'si-1',
        itemId: 'item-x',
        rank: 1,
      });
    });
  });

  describe('equip (validation slot)', () => {
    it('jette BadRequestException si le slot est incompatible avec le type d\'item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'inv-1',
        playerId: 'p1',
        item: { type: 'WEAPON' },
      });
      await expect(
        service.equip('p1', 'inv-1', EquipmentSlotType.ARMOR_CHEST),
      ).rejects.toThrow(BadRequestException);
    });

    it('autorise WEAPON → WEAPON_LEFT', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'inv-1',
        playerId: 'p1',
        item: { type: 'WEAPON' },
      });
      await expect(
        service.equip('p1', 'inv-1', EquipmentSlotType.WEAPON_LEFT),
      ).resolves.toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(GAME_EVENTS.ITEM_EQUIPPED, expect.any(Object));
    });

    it('autorise WEAPON → WEAPON_RIGHT', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'inv-1',
        playerId: 'p1',
        item: { type: 'WEAPON' },
      });
      await expect(
        service.equip('p1', 'inv-1', EquipmentSlotType.WEAPON_RIGHT),
      ).resolves.toBeDefined();
    });

    it('rejette ARMOR_HEAD dans WEAPON_LEFT', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'inv-1',
        playerId: 'p1',
        item: { type: 'ARMOR_HEAD' },
      });
      await expect(
        service.equip('p1', 'inv-1', EquipmentSlotType.WEAPON_LEFT),
      ).rejects.toThrow(/ne peut pas être équipé/);
    });

    it('jette NotFoundException si ni inventoryItem ni sessionItem (hors session)', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      gameSession.getActiveSession.mockResolvedValue(null);
      await expect(
        service.equip('p1', 'id-inconnu', EquipmentSlotType.WEAPON_LEFT),
      ).rejects.toThrow(NotFoundException);
    });

    it('fallback sur sessionItem si pas d\'inventoryItem et session active', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      gameSession.getActiveSession.mockResolvedValue({ id: 'gs-1' });
      prisma.sessionItem.findFirst.mockResolvedValue({
        id: 'si-1',
        playerId: 'p1',
        sessionId: 'gs-1',
        item: { type: 'ARMOR_CHEST' },
      });
      await service.equip('p1', 'si-1', EquipmentSlotType.ARMOR_CHEST);
      expect(prisma.equipmentSlot.upsert).toHaveBeenCalled();
    });

    it('jette NotFoundException si sessionItem introuvable même avec session active', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      gameSession.getActiveSession.mockResolvedValue({ id: 'gs-1' });
      prisma.sessionItem.findFirst.mockResolvedValue(null);
      await expect(
        service.equip('p1', 'inconnu', EquipmentSlotType.ARMOR_HEAD),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unequip', () => {
    it('met le slot à null et émet ITEM_UNEQUIPPED', async () => {
      await service.unequip('p1', EquipmentSlotType.WEAPON_LEFT);

      expect(prisma.equipmentSlot.update).toHaveBeenCalledWith({
        where: { playerId_slot: { playerId: 'p1', slot: EquipmentSlotType.WEAPON_LEFT } },
        data: { inventoryItemId: null, sessionItemId: null },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        GAME_EVENTS.ITEM_UNEQUIPPED,
        { playerId: 'p1', slot: EquipmentSlotType.WEAPON_LEFT },
      );
    });
  });
});

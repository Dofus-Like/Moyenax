import type { CombatState } from '@game/shared-types';
import { TerrainType } from '@game/shared-types';
import { BadRequestException } from '@nestjs/common';

import { PlaygroundService } from './playground.service';

type Mocked = Record<string, jest.Mock>;

function makeState(): CombatState {
  return {
    sessionId: 'sess-1',
    currentTurnPlayerId: 'human',
    turnNumber: 1,
    isPlayground: true,
    players: {},
    map: {
      width: 2,
      height: 2,
      tiles: [
        { x: 0, y: 0, type: TerrainType.GROUND },
        { x: 1, y: 0, type: TerrainType.GROUND },
        { x: 0, y: 1, type: TerrainType.GROUND },
        { x: 1, y: 1, type: TerrainType.WOOD },
      ],
    },
  };
}

describe('PlaygroundService', () => {
  let service: PlaygroundService;
  let session: Mocked;
  let equipment: Mocked;
  let inventory: Mocked;
  let redis: Mocked;
  let sse: Mocked;
  let prisma: { item: Mocked; inventoryItem: Mocked };
  let state: CombatState;

  beforeEach(() => {
    state = makeState();
    session = {
      startPlaygroundCombat: jest.fn(),
      getStateForParticipant: jest.fn().mockResolvedValue(state),
      refreshPlaygroundLoadout: jest.fn(),
    };
    equipment = { equip: jest.fn(), unequip: jest.fn() };
    inventory = { addResourceByName: jest.fn() };
    redis = { setJson: jest.fn() };
    sse = { emit: jest.fn() };
    prisma = {
      item: { findUnique: jest.fn() },
      inventoryItem: { findFirst: jest.fn(), create: jest.fn() },
    };

    service = new PlaygroundService(
      session as never,
      equipment as never,
      inventory as never,
      redis as never,
      sse as never,
      prisma as never,
    );
  });

  describe('paintTile', () => {
    it('change le type de la case et diffuse STATE_UPDATED', async () => {
      const result = await service.paintTile('human', 'sess-1', {
        x: 0,
        y: 0,
        terrain: TerrainType.IRON,
      });

      expect(result.map.tiles.find((t) => t.x === 0 && t.y === 0)?.type).toBe(TerrainType.IRON);
      expect(redis.setJson).toHaveBeenCalledWith('combat:sess-1', state, 3600);
      expect(sse.emit).toHaveBeenCalledWith('sess-1', 'STATE_UPDATED', state);
    });

    it('rejette une case introuvable', async () => {
      await expect(
        service.paintTile('human', 'sess-1', { x: 9, y: 9, terrain: TerrainType.IRON }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('gatherTile', () => {
    it('récolte un node, l’ajoute à l’inventaire et repasse la case en sol', async () => {
      const result = await service.gatherTile('human', 'sess-1', { x: 1, y: 1 });

      expect(inventory.addResourceByName).toHaveBeenCalledWith('human', 'Bois');
      expect(result.map.tiles.find((t) => t.x === 1 && t.y === 1)?.type).toBe(TerrainType.GROUND);
      expect(sse.emit).toHaveBeenCalledWith('sess-1', 'STATE_UPDATED', state);
    });

    it('rejette une case non récoltable', async () => {
      await expect(
        service.gatherTile('human', 'sess-1', { x: 0, y: 0 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(inventory.addResourceByName).not.toHaveBeenCalled();
    });
  });

  describe('grantAndEquip', () => {
    it('crée l’objet en inventaire, l’équipe puis rafraîchit le loadout', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'item-1', type: 'ACCESSORY' });
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });
      session.refreshPlaygroundLoadout.mockResolvedValue(state);

      await service.grantAndEquip('human', 'sess-1', {
        itemId: 'item-1',
        slot: 'ACCESSORY' as never,
      });

      expect(equipment.equip).toHaveBeenCalledWith('human', 'inv-1', 'ACCESSORY');
      expect(session.refreshPlaygroundLoadout).toHaveBeenCalledWith('sess-1', 'human');
    });
  });
});

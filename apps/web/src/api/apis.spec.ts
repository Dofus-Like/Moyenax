import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EquipmentSlotType } from '@game/shared-types';

vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

import { apiClient } from './client';
import { craftingApi } from './crafting.api';
import { equipmentApi } from './equipment.api';
import { farmingApi } from './farming.api';
import { gameSessionApi } from './game-session.api';
import { inventoryApi } from './inventory.api';
import { itemsApi } from './items.api';
import { mapApi } from './map.api';
import { playerApi } from './player.api';
import { resourcesApi } from './resources.api';
import { shopApi } from './shop.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('inventoryApi', () => {
  it('getInventory', () => {
    inventoryApi.getInventory();
    expect(apiClient.get).toHaveBeenCalledWith('/inventory');
  });
});

describe('equipmentApi', () => {
  it('getEquipment', () => {
    equipmentApi.getEquipment();
    expect(apiClient.get).toHaveBeenCalledWith('/equipment');
  });
  it('equip met PUT avec inventoryItemId', () => {
    equipmentApi.equip(EquipmentSlotType.WEAPON_LEFT, 'inv-1');
    expect(apiClient.put).toHaveBeenCalledWith(
      `/equipment/${EquipmentSlotType.WEAPON_LEFT}`,
      { inventoryItemId: 'inv-1' },
    );
  });
  it('unequip DELETE /equipment/:slot', () => {
    equipmentApi.unequip(EquipmentSlotType.ARMOR_HEAD);
    expect(apiClient.delete).toHaveBeenCalledWith(`/equipment/${EquipmentSlotType.ARMOR_HEAD}`);
  });
});

describe('shopApi', () => {
  it('getItems', () => {
    shopApi.getItems();
    expect(apiClient.get).toHaveBeenCalledWith('/shop/items');
  });
  it('buyItem', () => {
    shopApi.buyItem({ itemId: 'i', quantity: 3 });
    expect(apiClient.post).toHaveBeenCalledWith('/shop/buy', { itemId: 'i', quantity: 3 });
  });
  it('sellItem', () => {
    shopApi.sellItem({ inventoryItemId: 'inv', quantity: 1 });
    expect(apiClient.post).toHaveBeenCalledWith('/shop/sell', { inventoryItemId: 'inv', quantity: 1 });
  });
});

describe('craftingApi', () => {
  it('getRecipes', () => {
    craftingApi.getRecipes();
    expect(apiClient.get).toHaveBeenCalledWith('/crafting/recipes');
  });
  it('craftItem', () => {
    craftingApi.craftItem('item-1');
    expect(apiClient.post).toHaveBeenCalledWith('/crafting/craft', { itemId: 'item-1' });
  });
  it('mergeItem', () => {
    craftingApi.mergeItem('item-1', 3);
    expect(apiClient.post).toHaveBeenCalledWith('/crafting/merge', { itemId: 'item-1', currentRank: 3 });
  });
});

describe('farmingApi', () => {
  it('getState avec seed', async () => {
    await farmingApi.getState('NATURE');
    expect(apiClient.get).toHaveBeenCalledWith('/farming/state', { params: { seed: 'NATURE' } });
  });
  it('getState sans seed passe undefined', async () => {
    await farmingApi.getState();
    expect(apiClient.get).toHaveBeenCalledWith('/farming/state', { params: { seed: undefined } });
  });
  it('gather', async () => {
    await farmingApi.gather(1, 2, 3, 4);
    expect(apiClient.post).toHaveBeenCalledWith('/farming/gather', {
      targetX: 1, targetY: 2, playerX: 3, playerY: 4,
    });
  });
  it('endFarmingPhase', async () => {
    await farmingApi.endFarmingPhase();
    expect(apiClient.post).toHaveBeenCalledWith('/farming/end-farming-phase');
  });
  it('nextRound', async () => {
    await farmingApi.nextRound();
    expect(apiClient.post).toHaveBeenCalledWith('/farming/next-round');
  });
  it('debugRefill', async () => {
    await farmingApi.debugRefill();
    expect(apiClient.post).toHaveBeenCalledWith('/farming/debug-refill');
  });
});

describe('gameSessionApi', () => {
  it('joinQueue', () => {
    gameSessionApi.joinQueue();
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/join-queue');
  });
  it('leaveQueue', () => {
    gameSessionApi.leaveQueue();
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/leave-queue');
  });
  it('getQueueStatus', () => {
    gameSessionApi.getQueueStatus();
    expect(apiClient.get).toHaveBeenCalledWith('/game-session/queue-status');
  });
  it('getActiveSession', () => {
    gameSessionApi.getActiveSession();
    expect(apiClient.get).toHaveBeenCalledWith('/game-session/active', undefined);
  });
  it('endSession', () => {
    gameSessionApi.endSession('s-1');
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/end/s-1');
  });
  it('toggleReady sans sessionId', () => {
    gameSessionApi.toggleReady(true);
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/ready', { ready: true });
  });
  it('toggleReady avec sessionId', () => {
    gameSessionApi.toggleReady(false, 's-1');
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/ready', { ready: false, sessionId: 's-1' });
  });
  it('createPrivateSession', () => {
    gameSessionApi.createPrivateSession();
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/create-private');
  });
  it('joinPrivateSession', () => {
    gameSessionApi.joinPrivateSession('s-1');
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/join/s-1');
  });
  it('startVsAi', () => {
    gameSessionApi.startVsAi();
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/vs-ai');
  });
  it('getStreamTicket', () => {
    gameSessionApi.getStreamTicket('s-1');
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/session/s-1/stream-ticket');
  });
  it('resetSession', () => {
    gameSessionApi.resetSession();
    expect(apiClient.post).toHaveBeenCalledWith('/game-session/reset');
  });
  it('getInventory', () => {
    gameSessionApi.getInventory();
    expect(apiClient.get).toHaveBeenCalledWith('/game-session/inventory');
  });
  it('getWaitingSessions', () => {
    gameSessionApi.getWaitingSessions();
    expect(apiClient.get).toHaveBeenCalledWith('/game-session/waiting');
  });
});

describe('itemsApi', () => {
  it('getAll', () => {
    itemsApi.getAll();
    expect(apiClient.get).toHaveBeenCalledWith('/items');
  });
  it('getById', () => {
    itemsApi.getById('i-1');
    expect(apiClient.get).toHaveBeenCalledWith('/items/i-1');
  });
});

describe('mapApi', () => {
  it('getMap', async () => {
    await mapApi.getMap();
    expect(apiClient.get).toHaveBeenCalledWith('/map');
  });
  it('generateNew sans seed', async () => {
    await mapApi.generateNew();
    expect(apiClient.post).toHaveBeenCalledWith('/map/reset');
  });
  it('generateNew avec seed', async () => {
    await mapApi.generateNew('FORGE');
    expect(apiClient.post).toHaveBeenCalledWith('/map/reset?seed=FORGE');
  });
});

describe('playerApi', () => {
  it('getStats', () => {
    playerApi.getStats();
    expect(apiClient.get).toHaveBeenCalledWith('/player/stats');
  });
});

describe('resourcesApi', () => {
  it('getResources', () => {
    resourcesApi.getResources();
    expect(apiClient.get).toHaveBeenCalledWith('/map/resources');
  });
  it('gatherResource', () => {
    resourcesApi.gatherResource('wood');
    expect(apiClient.post).toHaveBeenCalledWith('/map/resources/wood/gather');
  });
});

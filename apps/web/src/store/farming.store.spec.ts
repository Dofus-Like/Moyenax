import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerrainType } from '@game/shared-types';

const mocks = vi.hoisted(() => ({
  farmingApi: {
    getState: vi.fn(),
    gather: vi.fn(),
    endFarmingPhase: vi.fn(),
    debugRefill: vi.fn(),
    nextRound: vi.fn(),
  },
  inventoryApi: {
    getInventory: vi.fn(),
  },
}));

vi.mock('../api/farming.api', () => ({
  farmingApi: mocks.farmingApi,
}));

vi.mock('../api/inventory.api', () => ({
  inventoryApi: mocks.inventoryApi,
}));

import { useFarmingStore } from './farming.store';

describe('useFarmingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFarmingStore.getState().reset();
  });

  it('hydrates a fresh farming state from the API', async () => {
    mocks.farmingApi.getState.mockResolvedValue({
      pips: 3,
      round: 2,
      spendableGold: 6,
      seedId: 'FORGE',
      map: [
        { x: 0, y: 0, terrain: TerrainType.GROUND },
        { x: 1, y: 1, terrain: TerrainType.GOLD },
      ],
    });
    mocks.inventoryApi.getInventory.mockResolvedValue({
      data: [{ quantity: 2, item: { name: 'Or', type: 'RESOURCE' } }],
    });

    await useFarmingStore.getState().fetchState();

    const state = useFarmingStore.getState();
    expect(state.pips).toBe(3);
    expect(state.round).toBe(2);
    expect(state.spendableGold).toBe(6);
    expect(state.seedId).toBe('FORGE');
    expect(state.inventory).toEqual({});
    expect(state.map?.grid[1][1]).toBe(TerrainType.GOLD);
    expect(state.isLoading).toBe(false);
  });

  it('refreshes map and spendable gold after gathering a gold node', async () => {
    useFarmingStore.setState({
      playerPosition: { x: 1, y: 1 },
      pips: 4,
      spendableGold: 2,
      map: {
        width: 20,
        height: 20,
        seedId: 'FORGE',
        grid: Array.from({ length: 20 }, () => Array(20).fill(TerrainType.GROUND)),
      },
    });
    mocks.farmingApi.gather.mockResolvedValue({
      pips: 3,
      spendableGold: 3,
      map: [{ x: 2, y: 2, terrain: TerrainType.GOLD }],
    });
    mocks.inventoryApi.getInventory.mockResolvedValue({
      data: [{ quantity: 1, item: { name: 'Or', type: 'RESOURCE' } }],
    });

    await useFarmingStore.getState().gatherNode(2, 2);

    const state = useFarmingStore.getState();
    expect(state.pips).toBe(3);
    expect(state.spendableGold).toBe(3);
    expect(state.inventory).toEqual({});
    expect(state.map?.grid[2][2]).toBe(TerrainType.GOLD);
  });

  it('updates round progress without keeping stale values around', async () => {
    useFarmingStore.setState({
      pips: 0,
      round: 4,
      seedId: 'FORGE',
      spendableGold: 3,
    });
    mocks.farmingApi.nextRound.mockResolvedValue({
      pips: 4,
      round: 5,
      spendableGold: 3,
    });

    await useFarmingStore.getState().nextRound();

    const state = useFarmingStore.getState();
    expect(state.round).toBe(5);
    expect(state.pips).toBe(4);
    expect(state.spendableGold).toBe(3);
  });

  it('fully resets transient farming state between games', () => {
    useFarmingStore.setState({
      inventory: { Bois: 4 },
      playerPosition: { x: 9, y: 7 },
      map: {
        width: 20,
        height: 20,
        seedId: 'NATURE',
        grid: Array.from({ length: 20 }, () => Array(20).fill(TerrainType.HERB)),
      },
      isHarvesting: true,
      pips: 1,
      round: 5,
      spendableGold: 9,
      seedId: 'NATURE',
      isLoading: true,
    });

    useFarmingStore.getState().reset();

    expect(useFarmingStore.getState()).toMatchObject({
      inventory: {},
      playerPosition: null,
      map: null,
      isHarvesting: false,
      pips: 4,
      round: 1,
      spendableGold: 0,
      seedId: null,
      isLoading: false,
    });
  });

  describe('simple setters', () => {
    it('harvestResource increments existing resource count', () => {
      useFarmingStore.setState({ inventory: { Bois: 2 } });
      useFarmingStore.getState().harvestResource('Bois', 3);
      expect(useFarmingStore.getState().inventory['Bois']).toBe(5);
    });

    it('harvestResource creates a new entry when resource was not present', () => {
      useFarmingStore.getState().harvestResource('Fer', 1);
      expect(useFarmingStore.getState().inventory['Fer']).toBe(1);
    });

    it('setInventory replaces the whole inventory map', () => {
      useFarmingStore.setState({ inventory: { Bois: 10, Fer: 5 } });
      useFarmingStore.getState().setInventory({ Cristal: 2 });
      expect(useFarmingStore.getState().inventory).toEqual({ Cristal: 2 });
    });

    it('movePlayer updates playerPosition', () => {
      useFarmingStore.getState().movePlayer({ x: 5, y: 7 });
      expect(useFarmingStore.getState().playerPosition).toEqual({ x: 5, y: 7 });
    });

    it('setHarvesting toggles the isHarvesting flag', () => {
      useFarmingStore.getState().setHarvesting(true);
      expect(useFarmingStore.getState().isHarvesting).toBe(true);
      useFarmingStore.getState().setHarvesting(false);
      expect(useFarmingStore.getState().isHarvesting).toBe(false);
    });
  });

  describe('gatherNode', () => {
    it('returns null immediately when pips are 0', async () => {
      useFarmingStore.setState({ pips: 0, playerPosition: { x: 0, y: 0 }, map: {
        width: 20, height: 20, seedId: 'FORGE',
        grid: Array.from({ length: 20 }, () => Array(20).fill(TerrainType.GROUND)),
      }});

      const result = await useFarmingStore.getState().gatherNode(1, 1);
      expect(result).toBeNull();
      expect(mocks.farmingApi.gather).not.toHaveBeenCalled();
    });

    it('returns null immediately when playerPosition is null', async () => {
      useFarmingStore.setState({ pips: 4, playerPosition: null, map: {
        width: 20, height: 20, seedId: 'FORGE',
        grid: Array.from({ length: 20 }, () => Array(20).fill(TerrainType.GROUND)),
      }});

      const result = await useFarmingStore.getState().gatherNode(1, 1);
      expect(result).toBeNull();
    });

    it('returns null immediately when map is null', async () => {
      useFarmingStore.setState({ pips: 4, playerPosition: { x: 0, y: 0 }, map: null });

      const result = await useFarmingStore.getState().gatherNode(1, 1);
      expect(result).toBeNull();
    });

    it('re-throws API errors so the caller can handle them', async () => {
      useFarmingStore.setState({
        pips: 4,
        playerPosition: { x: 0, y: 0 },
        map: {
          width: 20, height: 20, seedId: 'FORGE',
          grid: Array.from({ length: 20 }, () => Array(20).fill(TerrainType.GROUND)),
        },
      });
      mocks.farmingApi.gather.mockRejectedValue(new Error('Network error'));

      await expect(useFarmingStore.getState().gatherNode(1, 1)).rejects.toThrow('Network error');
    });
  });

  describe('endPhase', () => {
    it('updates pips and spendableGold after ending a phase', async () => {
      mocks.farmingApi.endFarmingPhase.mockResolvedValue({ pips: 0, spendableGold: 5 });

      await useFarmingStore.getState().endPhase();

      expect(useFarmingStore.getState().pips).toBe(0);
      expect(useFarmingStore.getState().spendableGold).toBe(5);
    });

    it('re-throws API errors', async () => {
      mocks.farmingApi.endFarmingPhase.mockRejectedValue(new Error('Server error'));

      await expect(useFarmingStore.getState().endPhase()).rejects.toThrow('Server error');
    });
  });

  describe('debugRefill', () => {
    it('refreshes pips and spendableGold', async () => {
      mocks.farmingApi.debugRefill.mockResolvedValue({ pips: 4, spendableGold: 0 });

      await useFarmingStore.getState().debugRefill();

      expect(useFarmingStore.getState().pips).toBe(4);
      expect(useFarmingStore.getState().spendableGold).toBe(0);
    });

    it('re-throws API errors', async () => {
      mocks.farmingApi.debugRefill.mockRejectedValue(new Error('Refill failed'));

      await expect(useFarmingStore.getState().debugRefill()).rejects.toThrow('Refill failed');
    });
  });

  describe('fetchState - error handling', () => {
    it('resets isLoading to false even when the API call fails', async () => {
      useFarmingStore.setState({ isLoading: true });
      mocks.farmingApi.getState.mockRejectedValue(new Error('API down'));

      await useFarmingStore.getState().fetchState();

      expect(useFarmingStore.getState().isLoading).toBe(false);
    });

    it('excludes Or from the inventory count (spendableGold tracks it separately)', async () => {
      mocks.farmingApi.getState.mockResolvedValue({
        pips: 4, round: 1, spendableGold: 3, seedId: 'FORGE',
        map: [],
      });
      mocks.inventoryApi.getInventory.mockResolvedValue({
        data: [
          { quantity: 5, item: { name: 'Or', type: 'RESOURCE' } },
          { quantity: 2, item: { name: 'Bois', type: 'RESOURCE' } },
        ],
      });

      await useFarmingStore.getState().fetchState();

      expect(useFarmingStore.getState().inventory).toEqual({ Bois: 2 });
    });
  });
});

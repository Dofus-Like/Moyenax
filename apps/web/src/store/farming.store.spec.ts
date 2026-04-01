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
});

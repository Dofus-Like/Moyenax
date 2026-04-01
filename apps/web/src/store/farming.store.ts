import { create } from 'zustand';
import { PathNode, SeedId, GameMap, TerrainType, FarmingState as FarmingApiState } from '@game/shared-types';
import { farmingApi } from '../api/farming.api';
import { inventoryApi } from '../api/inventory.api';

interface FarmingStoreState {
  inventory: Record<string, number>;
  playerPosition: PathNode | null;
  map: GameMap | null;
  isHarvesting: boolean;
  pips: number;
  round: number;
  spendableGold: number;
  seedId: SeedId | null;
  isLoading: boolean;

  harvestResource: (resourceId: string, amount: number) => void;
  setInventory: (inventory: Record<string, number>) => void;
  movePlayer: (position: PathNode) => void;
  setHarvesting: (harvesting: boolean) => void;
  fetchState: () => Promise<void>;
  gatherNode: (x: number, y: number) => Promise<FarmingApiState | null>;
  endPhase: () => Promise<void>;
  debugRefill: () => Promise<void>;
  nextRound: () => Promise<void>;
  reset: () => void;
}

interface InventoryEntry {
  quantity: number;
  item?: {
    name?: string;
    type?: string;
  };
}

function toInventoryCounts(entries: InventoryEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((accumulator, entry) => {
    if (entry.item?.type !== 'RESOURCE' || !entry.item.name || entry.item.name === 'Or') {
      return accumulator;
    }

    accumulator[entry.item.name] = (accumulator[entry.item.name] || 0) + entry.quantity;
    return accumulator;
  }, {});
}

export const useFarmingStore = create<FarmingStoreState>((set, get) => ({
  inventory: {},
  playerPosition: null,
  map: null,
  isHarvesting: false,
  pips: 4,
  round: 1,
  spendableGold: 0,
  seedId: null,
  isLoading: false,

  harvestResource: (resourceId, amount) =>
    set((state) => ({
      inventory: { ...state.inventory, [resourceId]: (state.inventory[resourceId] || 0) + amount },
    })),

  setInventory: (inventory) => set({ inventory }),
  movePlayer: (position) => set({ playerPosition: position }),
  setHarvesting: (harvesting) => set({ isHarvesting: harvesting }),

  fetchState: async () => {
    set({ isLoading: true });
    try {
      const [state, inventoryResponse] = await Promise.all([
        farmingApi.getState(),
        inventoryApi.getInventory(),
      ]);
      const MAP_SIZE = 20;
      const grid: TerrainType[][] = Array.from({ length: MAP_SIZE }, () =>
        Array(MAP_SIZE).fill(TerrainType.GROUND),
      );
      state.map.forEach((cell) => {
        if (grid[cell.y] && cell.x < MAP_SIZE) {
          grid[cell.y][cell.x] = cell.terrain;
        }
      });
      set({
        pips: state.pips,
        round: state.round,
        spendableGold: state.spendableGold,
        seedId: state.seedId,
        inventory: toInventoryCounts(inventoryResponse.data as InventoryEntry[]),
        map: { width: MAP_SIZE, height: MAP_SIZE, grid, seedId: state.seedId },
        isLoading: false,
      });
    } catch (e) {
      console.error('Error fetching farming state', e);
      set({ isLoading: false });
    }
  },

  gatherNode: async (x, y) => {
    const { playerPosition, pips, map: currentMap } = get();
    if (pips <= 0 || !playerPosition || !currentMap) {
      return null;
    }

    try {
      const newState = await farmingApi.gather(x, y, playerPosition.x, playerPosition.y);
      const inventoryResponse = await inventoryApi.getInventory();
      const grid = currentMap.grid.map((row) => [...row]);
      newState.map.forEach((cell) => {
        grid[cell.y][cell.x] = cell.terrain;
      });
      set({
        pips: newState.pips,
        spendableGold: newState.spendableGold,
        inventory: toInventoryCounts(inventoryResponse.data as InventoryEntry[]),
        map: { ...currentMap, grid },
      });
      return newState;
    } catch (e) {
      console.error('Erreur lors de la rÇ¸colte', e);
      throw e;
    }
  },

  endPhase: async () => {
    try {
      const newState = await farmingApi.endFarmingPhase();
      set({ pips: newState.pips, spendableGold: newState.spendableGold });
    } catch (e) {
      console.error('Erreur lors de la fin de manche', e);
      throw e;
    }
  },

  debugRefill: async () => {
    try {
      const newState = await farmingApi.debugRefill();
      set({ pips: newState.pips, spendableGold: newState.spendableGold });
    } catch (e) {
      console.error('Erreur lors du refill debug', e);
      throw e;
    }
  },

  nextRound: async () => {
    try {
      const state = await farmingApi.nextRound();
      set({
        pips: state.pips,
        round: state.round,
        spendableGold: state.spendableGold,
      });
    } catch (e) {
      console.error('Erreur lors du passage Çÿ la manche suivante', e);
      throw e;
    }
  },

  reset: () =>
    set({
      inventory: {},
      playerPosition: null,
      map: null,
      isHarvesting: false,
      pips: 4,
      round: 1,
      spendableGold: 0,
      seedId: null,
      isLoading: false,
    }),
}));

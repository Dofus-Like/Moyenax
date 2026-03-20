import { create } from 'zustand';
import { PathNode, SeedId, GameMap, TerrainType } from '@game/shared-types';
import { farmingApi } from '../api/farming.api';

interface FarmingState {
  inventory: Record<string, number>;
  playerPosition: PathNode | null;
  map: GameMap | null;
  isHarvesting: boolean;
  pips: number;
  round: number;
  seedId: SeedId | null;
  
  // Actions
  harvestResource: (resourceId: string, amount: number) => void;
  setInventory: (inventory: Record<string, number>) => void;
  movePlayer: (position: PathNode) => void;
  setHarvesting: (harvesting: boolean) => void;
  fetchState: () => Promise<void>;
  gatherNode: (x: number, y: number) => Promise<void>;
  endPhase: () => Promise<void>;
  debugRefill: () => Promise<void>;
  nextRound: () => Promise<void>;
  reset: () => void;
}

export const useFarmingStore = create<FarmingState>((set, get) => ({
  inventory: {},
  playerPosition: null,
  map: null,
  isHarvesting: false,
  pips: 4,
  round: 1,
  seedId: null,

  harvestResource: (resourceId, amount) =>
    set((state) => ({
      inventory: { ...state.inventory, [resourceId]: (state.inventory[resourceId] || 0) + amount },
    })),

  setInventory: (inventory) => set({ inventory }),
  movePlayer: (position) => set({ playerPosition: position }),
  setHarvesting: (harvesting) => set({ isHarvesting: harvesting }),

  fetchState: async () => {
    try {
      const state = await farmingApi.getState();
      const MAP_SIZE = 20;
      const grid: TerrainType[][] = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(TerrainType.GROUND));
      state.map.forEach(cell => { grid[cell.y][cell.x] = cell.terrain; });
      set({ 
        pips: state.pips, 
        round: state.round, 
        seedId: state.seedId,
        map: { width: MAP_SIZE, height: MAP_SIZE, grid, seedId: state.seedId }
      });
    } catch (e) {
      console.error('Error fetching farming state', e);
    }
  },

  gatherNode: async (x, y) => {
    const { playerPosition, pips, map: currentMap } = get();
    if (pips <= 0 || !playerPosition || !currentMap) return;
    try {
      const newState = await farmingApi.gather(x, y, playerPosition.x, playerPosition.y);
      const grid = currentMap.grid.map(row => [...row]);
      newState.map.forEach(cell => { grid[cell.y][cell.x] = cell.terrain; });
      set({ 
        pips: newState.pips,
        map: { ...currentMap, grid }
      });
    } catch (e) {
      console.error('Erreur lors de la récolte', e);
      throw e;
    }
  },

  endPhase: async () => {
    try {
      const newState = await farmingApi.endFarmingPhase();
      set({ pips: newState.pips });
    } catch (e) {
      console.error('Erreur lors de la fin de manche', e);
      throw e;
    }
  },

  debugRefill: async () => {
    try {
      const newState = await farmingApi.debugRefill();
      set({ pips: newState.pips });
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
        round: state.round 
      });
    } catch (e) {
      console.error('Erreur lors du passage à la manche suivante', e);
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
      seedId: null,
    }),
}));

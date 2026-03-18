import { create } from 'zustand';
import { PathNode } from '@game/shared-types';

interface FarmingState {
  inventory: Record<string, number>;
  playerPosition: PathNode | null;
  isHarvesting: boolean;
  
  // Actions
  harvestResource: (resourceId: string, amount: number) => void;
  setInventory: (inventory: Record<string, number>) => void;
  movePlayer: (position: PathNode) => void;
  setHarvesting: (harvesting: boolean) => void;
  reset: () => void;
}

export const useFarmingStore = create<FarmingState>((set) => ({
  inventory: {},
  playerPosition: null,
  isHarvesting: false,

  harvestResource: (resourceId: string, amount: number) =>
    set((state) => ({
      inventory: {
        ...state.inventory,
        [resourceId]: (state.inventory[resourceId] || 0) + amount,
      },
    })),

  setInventory: (inventory: Record<string, number>) =>
    set({ inventory }),

  movePlayer: (position: PathNode) =>
    set({ playerPosition: position }),

  setHarvesting: (harvesting: boolean) =>
    set({ isHarvesting: harvesting }),

  reset: () =>
    set({
      inventory: {},
      playerPosition: null,
      isHarvesting: false,
    }),
}));

import { apiClient } from './client';
import { FarmingState, SeedId } from '@game/shared-types';

export const farmingApi = {
  getState: (seed?: SeedId) =>
    apiClient.get<FarmingState>('/farming/state', { params: { seed } }).then((res) => res.data),

  gather: (targetX: number, targetY: number, playerX: number, playerY: number) =>
    apiClient
      .post<FarmingState>('/farming/gather', { targetX, targetY, playerX, playerY })
      .then((res) => res.data),

  endFarmingPhase: () =>
    apiClient.post<FarmingState>('/farming/end-farming-phase').then((res) => res.data),

  debugRefill: () => apiClient.post<FarmingState>('/farming/debug-refill').then((res) => res.data),

  nextRound: () => apiClient.post<FarmingState>('/farming/next-round').then((res) => res.data),
};

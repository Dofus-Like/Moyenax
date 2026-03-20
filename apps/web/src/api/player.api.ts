import { apiClient } from './client';
import { PlayerStats } from '@game/shared-types';

export const playerApi = {
  getStats: () => apiClient.get<PlayerStats>('/player/stats'),
};

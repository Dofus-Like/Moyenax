import type { PlayerStats } from '@game/shared-types';

import { apiClient } from './client';

export const playerApi = {
  getStats: () => apiClient.get<PlayerStats>('/player/stats'),
};

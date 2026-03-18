import { apiClient } from './client';
import { GameMap, SeedId } from '@game/shared-types';

export const mapApi = {
  getMap: () => apiClient.get<GameMap>('/map').then((res) => res.data),
  generateNew: (seed?: SeedId) =>
    apiClient.post<GameMap>(`/map/reset${seed ? `?seed=${seed}` : ''}`).then((res) => res.data),
};

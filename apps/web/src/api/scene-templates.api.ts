import type { AxiosRequestConfig } from 'axios';

import type { SceneTemplate } from '@game/shared-types';

import { apiClient } from './client';

const URL = '/scenes';

export interface SceneSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface SavedScene {
  id: string;
  name: string;
  data: SceneTemplate;
}

export const scenesApi = {
  save: (name: string, data: SceneTemplate) => apiClient.post<SceneSummary>(URL, { name, data }),
  list: (config?: AxiosRequestConfig) => apiClient.get<SceneSummary[]>(URL, config),
  get: (id: string) => apiClient.get<SavedScene>(`${URL}/${id}`),
  remove: (id: string) => apiClient.delete(`${URL}/${id}`),
};

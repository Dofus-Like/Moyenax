import { apiClient } from './client';

export const itemsApi = {
  getAll: () => apiClient.get('/items'),
  getById: (id: string) => apiClient.get(`/items/${id}`),
};

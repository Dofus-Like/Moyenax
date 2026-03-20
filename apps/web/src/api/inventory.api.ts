import { apiClient } from './client';

export const inventoryApi = {
  getInventory: () => apiClient.get('/inventory'),
};

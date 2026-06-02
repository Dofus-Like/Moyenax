import { apiClient } from './client';

export const inventoryApi = {
  getInventory: () => apiClient.get('/inventory'),
  useItem: (itemId: string) => apiClient.post('/inventory/use', { itemId }),
};

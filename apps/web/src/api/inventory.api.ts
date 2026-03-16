import { apiClient } from './client';

export const inventoryApi = {
  getInventory: () => apiClient.get('/inventory'),
  equipItem: (itemId: string) => apiClient.put(`/inventory/equip/${itemId}`),
  unequipItem: (itemId: string) => apiClient.put(`/inventory/unequip/${itemId}`),
};

import { apiClient } from './client';

export const shopApi = {
  getItems: () => apiClient.get('/shop/items'),
  buyItem: (dto: { itemId: string; quantity: number }) => apiClient.post('/shop/buy', dto),
  sellItem: (dto: { inventoryItemId: string; quantity: number }) => apiClient.post('/shop/sell', dto),
};

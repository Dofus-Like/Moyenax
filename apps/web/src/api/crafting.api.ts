import { apiClient } from './client';

export const craftingApi = {
  getRecipes: () => apiClient.get('/crafting/recipes'),
  craftItem: (itemId: string) => apiClient.post('/crafting/craft', { itemId }),
};

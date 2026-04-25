import type { EquipmentSlotType } from '@game/shared-types';

import { apiClient } from './client';

export const equipmentApi = {
  getEquipment: () => apiClient.get('/equipment'),
  equip: (slot: EquipmentSlotType, inventoryItemId: string) => 
    apiClient.put(`/equipment/${slot}`, { inventoryItemId }),
  unequip: (slot: EquipmentSlotType) => 
    apiClient.delete(`/equipment/${slot}`),
};

import { apiClient } from './client';
import { EquipmentSlotType } from '@game/shared-types';

export const equipmentApi = {
  getEquipment: () => apiClient.get('/equipment'),
  equip: (slot: EquipmentSlotType, inventoryItemId: string) =>
    apiClient.put(`/equipment/${slot}`, { inventoryItemId }),
  unequip: (slot: EquipmentSlotType) => apiClient.delete(`/equipment/${slot}`),
};

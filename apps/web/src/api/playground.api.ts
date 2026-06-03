import type { CombatState, EquipmentSlotType, TerrainType } from '@game/shared-types';

import { apiClient } from './client';

export const playgroundApi = {
  start: () => apiClient.post<CombatState>('/playground/start'),
  startCombat: () => apiClient.post<CombatState>('/playground/combat'),
  paint: (sessionId: string, body: { x: number; y: number; terrain: TerrainType }) =>
    apiClient.post<CombatState>(`/playground/${sessionId}/paint`, body),
  gather: (sessionId: string, body: { x: number; y: number }) =>
    apiClient.post<CombatState>(`/playground/${sessionId}/gather`, body),
  grantEquip: (sessionId: string, body: { itemId: string; slot: EquipmentSlotType }) =>
    apiClient.post<CombatState>(`/playground/${sessionId}/grant-equip`, body),
  unequip: (sessionId: string, body: { slot: EquipmentSlotType }) =>
    apiClient.post<CombatState>(`/playground/${sessionId}/unequip`, body),
};

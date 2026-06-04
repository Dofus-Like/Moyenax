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
  addDummy: (sessionId: string, body: { x: number; y: number }) =>
    apiClient.post<CombatState>(`/playground/${sessionId}/dummy`, body),
  setDummy: (
    sessionId: string,
    body: { dummyId: string; def?: number; res?: number; vit?: number },
  ) => apiClient.patch<CombatState>(`/playground/${sessionId}/dummy`, body),
  removeDummy: (sessionId: string, dummyId: string) =>
    apiClient.delete<CombatState>(`/playground/${sessionId}/dummy/${dummyId}`),
  resetDummies: (sessionId: string) =>
    apiClient.post<CombatState>(`/playground/${sessionId}/dummy/reset`),
  setPlayerStats: (
    sessionId: string,
    body: { atk?: number; mag?: number; def?: number; res?: number; vit?: number },
  ) => apiClient.post<CombatState>(`/playground/${sessionId}/player-stats`, body),
  setNoCooldown: (sessionId: string, enabled: boolean) =>
    apiClient.post<CombatState>(`/playground/${sessionId}/no-cooldown`, { enabled }),
};

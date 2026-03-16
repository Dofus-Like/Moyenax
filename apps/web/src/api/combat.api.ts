import { apiClient } from './client';
import { CombatAction } from '@game/shared-types';

export const combatApi = {
  challengePlayer: (targetId: string) => apiClient.post(`/combat/challenge/${targetId}`),
  acceptChallenge: (sessionId: string) => apiClient.post(`/combat/accept/${sessionId}`),
  playAction: (sessionId: string, action: CombatAction) =>
    apiClient.post(`/combat/action/${sessionId}`, action),
  getHistory: () => apiClient.get('/combat/history'),
};

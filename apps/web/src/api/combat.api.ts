import { apiClient } from './client';
import { CombatAction } from '@game/shared-types';

export const combatApi = {
  getRooms: () => apiClient.get('/combat/rooms'),
  createRoom: () => apiClient.post('/combat/challenge'),
  challengePlayer: (targetId: string) => apiClient.post(`/combat/challenge/${targetId}`),
  acceptChallenge: (sessionId: string) => apiClient.post(`/combat/accept/${sessionId}`),
  playAction: (sessionId: string, action: CombatAction) =>
    apiClient.post(`/combat/action/${sessionId}`, action),
  forcePlayAction: (sessionId: string, asPlayerId: string, action: CombatAction) =>
    apiClient.post(`/combat/action/${sessionId}/force`, { asPlayerId, action }),
  startTestCombat: () => apiClient.post('/combat/test'),
  startVsAiCombat: () => apiClient.post('/combat/vs-ai'),
  getState: (sessionId: string) => apiClient.get(`/combat/session/${sessionId}`),
  getHistory: () => apiClient.get('/combat/history'),
};

import { apiClient } from './client';

const API_URL = '/game-session';

export const gameSessionApi = {
  joinQueue: () => apiClient.post(`${API_URL}/join-queue`),
  leaveQueue: () => apiClient.post(`${API_URL}/leave-queue`),
  getActiveSession: () => apiClient.get(`${API_URL}/active`),
  getInventory: () => apiClient.get(`${API_URL}/inventory`),
  endSession: (id: string) => apiClient.post(`${API_URL}/end/${id}`),
  toggleReady: (ready: boolean) => apiClient.post(`${API_URL}/ready`, { ready }),
  createPrivateSession: () => apiClient.post(`${API_URL}/create-private`),
  getWaitingSessions: () => apiClient.get(`${API_URL}/waiting`),
  joinPrivateSession: (sessionId: string) => apiClient.post(`${API_URL}/join/${sessionId}`),
  startVsAi: () => apiClient.post(`${API_URL}/vs-ai`),
};

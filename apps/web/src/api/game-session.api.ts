import { apiClient } from './client';

const API_URL = '/game-session';

export const gameSessionApi = {
  joinQueue: () => apiClient.post<{ status: string; sessionId?: string }>(`${API_URL}/join-queue`),
  leaveQueue: () => apiClient.post(`${API_URL}/leave-queue`),
  getQueueStatus: () => apiClient.get<{ queued: boolean }>(`${API_URL}/queue-status`),
  getActiveSession: () => apiClient.get(`${API_URL}/active`),
  getInventory: () => apiClient.get(`${API_URL}/inventory`),
  endSession: (id: string) => apiClient.post(`${API_URL}/end/${id}`),
  toggleReady: (ready: boolean, sessionId?: string) =>
    apiClient.post(`${API_URL}/ready`, sessionId ? { ready, sessionId } : { ready }),
  createPrivateSession: () => apiClient.post(`${API_URL}/create-private`),
  getWaitingSessions: () => apiClient.get(`${API_URL}/waiting`),
  joinPrivateSession: (sessionId: string) => apiClient.post(`${API_URL}/join/${sessionId}`),
  startVsAi: () => apiClient.post(`${API_URL}/vs-ai`),
  getStreamTicket: (sessionId: string) =>
    apiClient.post<{ ticket: string; expiresIn: number }>(`${API_URL}/session/${sessionId}/stream-ticket`),
};

import { apiClient } from './client';

export const authApi = {
  register: (dto: { username: string; email: string; password: string }) =>
    apiClient.post<{ accessToken: string }>('/auth/register', dto),

  login: (dto: { email: string; password: string }) =>
    apiClient.post<{ accessToken: string }>('/auth/login', dto),

  getMe: () =>
    apiClient.get<{ id: string; username: string; email: string; gold: number }>('/auth/me'),
};

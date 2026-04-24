import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../store/auth.store', () => {
  const store = {
    token: null as string | null,
    logout: vi.fn(),
  };
  return {
    useAuthStore: {
      getState: () => store,
    },
    __store: store,
  };
});

import { apiClient } from './client';
import { useAuthStore } from '../store/auth.store';

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore.getState() as { token: string | null }).token = null;
  });

  afterEach(() => {
    (useAuthStore.getState() as { token: string | null }).token = null;
  });

  describe('request interceptor - ajout Authorization', () => {
    it('ajoute Bearer token si présent', async () => {
      (useAuthStore.getState() as { token: string | null }).token = 'my-token';
      const config = { headers: {} } as any;

      // Récupère le handler directement depuis l'instance
      const interceptor = (apiClient.interceptors.request as any).handlers[0];
      const result = interceptor.fulfilled(config);

      expect(result.headers.Authorization).toBe('Bearer my-token');
    });

    it('n\'ajoute pas Authorization si token null', async () => {
      (useAuthStore.getState() as { token: string | null }).token = null;
      const config = { headers: {} } as any;

      const interceptor = (apiClient.interceptors.request as any).handlers[0];
      const result = interceptor.fulfilled(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor - gestion 401', () => {
    it('logout auto sur 401', async () => {
      const interceptor = (apiClient.interceptors.response as any).handlers[0];
      const error = { response: { status: 401 } };
      await expect(interceptor.rejected(error)).rejects.toEqual(error);
      expect(useAuthStore.getState().logout).toHaveBeenCalled();
    });

    it('ne logout PAS sur 403', async () => {
      const interceptor = (apiClient.interceptors.response as any).handlers[0];
      const error = { response: { status: 403 } };
      await expect(interceptor.rejected(error)).rejects.toEqual(error);
      expect(useAuthStore.getState().logout).not.toHaveBeenCalled();
    });

    it('ne logout PAS sur 500', async () => {
      const interceptor = (apiClient.interceptors.response as any).handlers[0];
      const error = { response: { status: 500 } };
      await expect(interceptor.rejected(error)).rejects.toEqual(error);
      expect(useAuthStore.getState().logout).not.toHaveBeenCalled();
    });

    it('gère erreur sans response (network error)', async () => {
      const interceptor = (apiClient.interceptors.response as any).handlers[0];
      const error = new Error('Network Error');
      await expect(interceptor.rejected(error)).rejects.toBe(error);
      expect(useAuthStore.getState().logout).not.toHaveBeenCalled();
    });
  });
});

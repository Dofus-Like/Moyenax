import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { authApi } from './auth.api';
import { apiClient } from './client';

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register POST /auth/register avec le DTO', () => {
    authApi.register({
      username: 'alice',
      email: 'a@b.com',
      password: 'pw',
      selectedClass: 'warrior',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
      username: 'alice',
      email: 'a@b.com',
      password: 'pw',
      selectedClass: 'warrior',
    });
  });

  it('login POST /auth/login', () => {
    authApi.login({ email: 'a@b.com', password: 'pw' });
    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: 'pw',
    });
  });

  it('getMe GET /auth/me', () => {
    authApi.getMe();
    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
  });

  it('updateSkin POST /auth/skin avec skin', () => {
    authApi.updateSkin('mage');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/skin', { skin: 'mage' });
  });
});

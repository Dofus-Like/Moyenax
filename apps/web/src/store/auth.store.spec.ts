import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// HOISTED: stub localStorage AVANT tout import de module
const { _lsStore } = vi.hoisted(() => {
  const _lsStore = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (_lsStore.has(k) ? (_lsStore.get(k) ?? null) : null),
    setItem: (k: string, v: string) => _lsStore.set(k, String(v)),
    removeItem: (k: string) => _lsStore.delete(k),
    clear: () => _lsStore.clear(),
  };
  (globalThis as unknown as { localStorage: typeof stub }).localStorage = stub;
  return { _lsStore };
});

// Mocker authApi avant l'import du store
vi.mock('../api/auth.api', () => ({
  authApi: {
    getMe: vi.fn(),
    updateSkin: vi.fn(),
  },
}));

import { useAuthStore } from './auth.store';
import { authApi } from '../api/auth.api';

describe('useAuthStore', () => {
  beforeEach(() => {
    _lsStore.clear();
    // Reset store à l'état initial
    useAuthStore.setState({ token: null, player: null });
    vi.clearAllMocks();
  });

  afterEach(() => {
    _lsStore.clear();
  });

  it('setToken persiste dans localStorage et met à jour le state', () => {
    useAuthStore.getState().setToken('jwt-abc');
    expect(localStorage.getItem('token')).toBe('jwt-abc');
    expect(useAuthStore.getState().token).toBe('jwt-abc');
  });

  it('setPlayer met à jour le player sans toucher au token', () => {
    useAuthStore.setState({ token: 'existing' });
    const player = {
      id: 'p1',
      username: 'alice',
      email: 'a@b.com',
      gold: 100,
      skin: 'warrior',
    };
    useAuthStore.getState().setPlayer(player);
    expect(useAuthStore.getState().player).toEqual(player);
    expect(useAuthStore.getState().token).toBe('existing');
  });

  it('logout supprime token + player + localStorage', () => {
    localStorage.setItem('token', 'abc');
    useAuthStore.setState({
      token: 'abc',
      player: { id: 'p1', username: 'alice', email: 'a@b.com', gold: 0, skin: 'warrior' },
    });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().player).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('refreshPlayer ne fait rien si pas de token', async () => {
    await useAuthStore.getState().refreshPlayer();
    expect(authApi.getMe).not.toHaveBeenCalled();
  });

  it('refreshPlayer charge le profil si token', async () => {
    useAuthStore.setState({ token: 'abc' });
    const player = { id: 'p1', username: 'alice', email: 'a', gold: 0, skin: 'x' };
    vi.mocked(authApi.getMe).mockResolvedValue({ data: player } as unknown as Awaited<ReturnType<typeof authApi.getMe>>);
    await useAuthStore.getState().refreshPlayer();
    expect(useAuthStore.getState().player).toEqual(player);
  });

  it('refreshPlayer log une erreur si api échoue mais ne throw pas', async () => {
    useAuthStore.setState({ token: 'abc' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('network'));
    await expect(useAuthStore.getState().refreshPlayer()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('setSkin appelle l\'API et met à jour localement', async () => {
    useAuthStore.setState({
      token: 'abc',
      player: { id: 'p1', username: 'alice', email: 'a', gold: 0, skin: 'warrior' },
    });
    vi.mocked(authApi.updateSkin).mockResolvedValue({ data: { skin: 'mage' } } as Awaited<ReturnType<typeof authApi.updateSkin>>);
    await useAuthStore.getState().setSkin('mage');
    expect(authApi.updateSkin).toHaveBeenCalledWith('mage');
    expect(useAuthStore.getState().player?.skin).toBe('mage');
  });

  it('setSkin ne change rien si pas de player chargé', async () => {
    vi.mocked(authApi.updateSkin).mockResolvedValue({ data: { skin: 'mage' } } as Awaited<ReturnType<typeof authApi.updateSkin>>);
    await useAuthStore.getState().setSkin('mage');
    expect(useAuthStore.getState().player).toBeNull();
  });

  it('setSkin catch l\'erreur silencieusement', async () => {
    useAuthStore.setState({
      token: 'abc',
      player: { id: 'p1', username: 'a', email: '', gold: 0, skin: 'x' },
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(authApi.updateSkin).mockRejectedValue(new Error('fail'));
    await expect(useAuthStore.getState().setSkin('mage')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('initialize charge le player si token présent et player absent', async () => {
    useAuthStore.setState({ token: 'abc', player: null });
    const player = { id: 'p1', username: 'a', email: '', gold: 0, skin: 'x' };
    vi.mocked(authApi.getMe).mockResolvedValue({ data: player } as Awaited<ReturnType<typeof authApi.getMe>>);
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().player).toEqual(player);
  });

  it('initialize ne charge pas si player déjà présent', async () => {
    useAuthStore.setState({
      token: 'abc',
      player: { id: 'p1', username: 'a', email: '', gold: 0, skin: 'x' },
    });
    await useAuthStore.getState().initialize();
    expect(authApi.getMe).not.toHaveBeenCalled();
  });

  it('initialize clear le token si l\'appel échoue (JWT invalide)', async () => {
    localStorage.setItem('token', 'expired-jwt');
    useAuthStore.setState({ token: 'expired-jwt', player: null });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('401'));
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    spy.mockRestore();
  });
});

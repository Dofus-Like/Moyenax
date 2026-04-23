import { create } from 'zustand';
import { authApi } from '../api/auth.api';

interface PlayerProfile {
  id: string;
  username: string;
  email: string;
  gold: number;
  skin: string;
}

interface AuthState {
  token: string | null;
  player: PlayerProfile | null;
  setToken: (token: string) => void;
  setPlayer: (player: PlayerProfile) => void;
  setSkin: (skin: string) => Promise<void>;
  refreshPlayer: () => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  player: null,

  setToken: (token: string) => {
    localStorage.setItem('token', token);
    set({ token });
  },

  setPlayer: (player: PlayerProfile) => {
    set({ player });
  },

  setSkin: async (skin: string) => {
    try {
      await authApi.updateSkin(skin);
      const player = get().player;
      if (player) {
        set({ player: { ...player, skin } });
      }
    } catch (err) {
      console.error('Failed to update skin', err);
    }
  },

  refreshPlayer: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const response = await authApi.getMe();
      set({ player: response.data });
    } catch (err) {
      console.error('Failed to refresh player', err);
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, player: null });
  },

  initialize: async () => {
    const { token, player } = get();
    if (token && !player) {
      try {
        const response = await authApi.getMe();
        set({ player: response.data });
      } catch (err) {
        console.error('Failed to initialize auth store', err);
        localStorage.removeItem('token');
        set({ token: null });
      }
    }
  },
}));

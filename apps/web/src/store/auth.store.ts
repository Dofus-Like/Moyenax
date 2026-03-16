import { create } from 'zustand';

interface PlayerProfile {
  id: string;
  username: string;
  email: string;
  gold: number;
}

interface AuthState {
  token: string | null;
  player: PlayerProfile | null;
  setToken: (token: string) => void;
  setPlayer: (player: PlayerProfile) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  player: null,

  setToken: (token: string) => {
    localStorage.setItem('token', token);
    set({ token });
  },

  setPlayer: (player: PlayerProfile) => {
    set({ player });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, player: null });
  },
}));

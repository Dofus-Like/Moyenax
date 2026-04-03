import { create } from 'zustand';

export type Theme = 'modern' | 'retro';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'moyenax-theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'modern' || stored === 'retro') return stored;
  return 'retro';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),

  toggleTheme: () => {
    const next = get().theme === 'modern' ? 'retro' : 'modern';
    localStorage.setItem(STORAGE_KEY, next);
    set({ theme: next });
  },

  setTheme: (theme: Theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
}));

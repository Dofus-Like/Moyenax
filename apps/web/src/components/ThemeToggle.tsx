import React from 'react';
import { useThemeStore } from '../store/theme.store';
import './ThemeToggle.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      title={`Passer en mode ${theme === 'modern' ? 'Retro 90s' : 'Modern'}`}
    >
      {theme === 'modern' ? '🕹️ Retro' : '✨ Modern'}
    </button>
  );
}

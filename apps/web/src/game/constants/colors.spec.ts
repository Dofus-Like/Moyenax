import { describe, it, expect } from 'vitest';
import { COMBAT_COLORS } from './colors';

describe('COMBAT_COLORS', () => {
  it('expose les tokens de couleurs combat principaux', () => {
    expect(COMBAT_COLORS.PA_YELLOW).toMatch(/^#[0-9a-f]{6}$/);
    expect(COMBAT_COLORS.PM_VIOLET).toMatch(/^#[0-9a-f]{6}$/);
    expect(COMBAT_COLORS.HP_RED).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('toutes les valeurs string sont des hex colors', () => {
    for (const [key, value] of Object.entries(COMBAT_COLORS)) {
      if (typeof value === 'string') {
        expect(value, `${key} is not a valid hex color`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('injection CSS custom properties sur :root', () => {
    // Importer le module déclenche l'IIFE d'injection
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--pa-yellow')).toBe(COMBAT_COLORS.PA_YELLOW);
    expect(style.getPropertyValue('--pa-yellow-rgb')).toMatch(/^\d+ \d+ \d+$/);
  });
});

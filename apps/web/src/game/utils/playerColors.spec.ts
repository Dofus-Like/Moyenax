import { describe, it, expect } from 'vitest';
import {
  ARCHETYPE_COLORS,
  getPlayerArchetype,
  getPlayerColors,
} from './playerColors';

describe('playerColors', () => {
  describe('ARCHETYPE_COLORS', () => {
    it('définit des couleurs pour FORGE, ARCANE, NATURE, NEUTRAL, SPECIAL', () => {
      for (const key of ['FORGE', 'ARCANE', 'NATURE', 'NEUTRAL', 'SPECIAL'] as const) {
        expect(ARCHETYPE_COLORS[key]).toMatchObject({
          primary: expect.stringMatching(/^#[0-9a-f]{6}$/),
          secondary: expect.stringMatching(/^#[0-9a-f]{6}$/),
          emissive: expect.stringMatching(/^#[0-9a-f]{6}$/),
        });
      }
    });
  });

  describe('getPlayerArchetype', () => {
    it('retourne NEUTRAL (TODO: analyser inventaire)', () => {
      expect(getPlayerArchetype()).toBe('NEUTRAL');
      expect(getPlayerArchetype([])).toBe('NEUTRAL');
      expect(getPlayerArchetype(null)).toBe('NEUTRAL');
    });
  });

  describe('getPlayerColors', () => {
    it('retourne les couleurs NEUTRAL', () => {
      const colors = getPlayerColors();
      expect(colors).toEqual(ARCHETYPE_COLORS.NEUTRAL);
    });
  });
});

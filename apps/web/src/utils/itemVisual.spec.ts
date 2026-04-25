import { describe, it, expect } from 'vitest';
import { getItemVisualMeta } from './itemVisual';

describe('getItemVisualMeta', () => {
  it('retourne icon de famille si family présente (priorité)', () => {
    expect(getItemVisualMeta({ type: 'WEAPON', family: 'FORGE' })).toEqual({
      icon: '🔥',
      iconPath: undefined,
      toneClass: 'forge',
    });
  });

  it('retourne icon par type si family absente', () => {
    expect(getItemVisualMeta({ type: 'WEAPON', family: null }).icon).toBe('⚔️');
    expect(getItemVisualMeta({ type: 'ARMOR_HEAD' }).icon).toBe('⛑️');
    expect(getItemVisualMeta({ type: 'ARMOR_CHEST' }).icon).toBe('🛡️');
    expect(getItemVisualMeta({ type: 'ARMOR_LEGS' }).icon).toBe('🥾');
    expect(getItemVisualMeta({ type: 'ACCESSORY' }).icon).toBe('💍');
    expect(getItemVisualMeta({ type: 'CONSUMABLE' }).icon).toBe('🧪');
    expect(getItemVisualMeta({ type: 'RESOURCE' }).icon).toBe('🪨');
  });

  it('fallback emoji 🎒 si ni family ni type valides', () => {
    expect(getItemVisualMeta({}).icon).toBe('🎒');
    expect(getItemVisualMeta({ type: 'UNKNOWN', family: 'XXX' }).icon).toBe('🎒');
  });

  it('toneClass = "neutral" si family absente', () => {
    expect(getItemVisualMeta({ type: 'WEAPON' }).toneClass).toBe('neutral');
    expect(getItemVisualMeta({}).toneClass).toBe('neutral');
  });

  it('toneClass = family.toLowerCase() si family présente', () => {
    expect(getItemVisualMeta({ family: 'ARCANE' }).toneClass).toBe('arcane');
    expect(getItemVisualMeta({ family: 'NATURE' }).toneClass).toBe('nature');
    expect(getItemVisualMeta({ family: 'SPECIAL' }).toneClass).toBe('special');
  });

  it('passe iconPath si fourni', () => {
    expect(getItemVisualMeta({ type: 'WEAPON', iconPath: '/img/sword.png' }).iconPath).toBe(
      '/img/sword.png',
    );
  });

  it('normalize case (accepte "weapon" en minuscules)', () => {
    expect(getItemVisualMeta({ type: 'weapon' }).icon).toBe('⚔️');
    expect(getItemVisualMeta({ family: 'forge' }).icon).toBe('🔥');
  });
});

import type { SpellDefinition } from '@game/shared-types';
import { SpellEffectKind, SpellFamily, SpellType, SpellVisualType } from '@game/shared-types';
import { describe, expect, it } from 'vitest';

import { spellVfxType } from './vfx';

function spell(over: Partial<SpellDefinition>): SpellDefinition {
  return {
    id: 'x',
    code: 'x',
    name: 'X',
    description: null,
    paCost: 1,
    minRange: 1,
    maxRange: 1,
    damage: { min: 0, max: 0 },
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PHYSICAL,
    family: SpellFamily.COMMON,
    iconPath: null,
    sortOrder: 0,
    requiresLineOfSight: false,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
    effectConfig: null,
    ...over,
  };
}

describe('spellVfxType (aligné sur le combat : seuls les PROJECTILE)', () => {
  it('mappe la boule de feu (id minuscule) vers le VFX feu', () => {
    expect(
      spellVfxType(
        spell({
          code: 'spell-boule-de-feu',
          visualType: SpellVisualType.PROJECTILE,
          effectKind: SpellEffectKind.DAMAGE_MAGICAL,
        }),
      ),
    ).toBe('spell-fireball');
  });

  it('mappe le kunai (PROJECTILE) vers son VFX dédié', () => {
    expect(
      spellVfxType(spell({ code: 'spell-kunai', visualType: SpellVisualType.PROJECTILE })),
    ).toBe('spell-kunai');
  });

  it('traite tout autre PROJECTILE comme une boule de feu', () => {
    expect(
      spellVfxType(spell({ code: 'spell-bombe-repousse', visualType: SpellVisualType.PROJECTILE })),
    ).toBe('spell-fireball');
  });

  it('ne lance AUCUN projectile pour une attaque physique au corps à corps', () => {
    expect(
      spellVfxType(spell({ code: 'spell-frappe', visualType: SpellVisualType.PHYSICAL })),
    ).toBeNull();
  });

  it('ne lance aucun projectile pour le soin ni les utilitaires', () => {
    expect(
      spellVfxType(
        spell({
          code: 'spell-soin',
          visualType: SpellVisualType.UTILITY,
          effectKind: SpellEffectKind.HEAL,
        }),
      ),
    ).toBeNull();
    expect(
      spellVfxType(spell({ code: 'spell-bond', visualType: SpellVisualType.UTILITY })),
    ).toBeNull();
    expect(spellVfxType(undefined)).toBeNull();
  });
});

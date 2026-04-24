import {
  SpellDefinition,
  SpellEffectKind,
  SpellFamily,
  SpellType,
  SpellVisualType,
} from '@game/shared-types';

export function makeSpell(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return {
    id: 'spell-1',
    code: 'FIREBALL',
    name: 'Boule de feu',
    description: 'Lance une boule de feu',
    paCost: 4,
    minRange: 1,
    maxRange: 6,
    damage: { min: 10, max: 20 },
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PROJECTILE,
    family: SpellFamily.MAGE,
    iconPath: null,
    sortOrder: 0,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_MAGICAL,
    effectConfig: null,
    ...overrides,
  };
}

export function makeDamagePhysicalSpell(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return makeSpell({
    id: 'spell-phys',
    code: 'SLASH',
    name: 'Entaille',
    damage: { min: 8, max: 12 },
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PHYSICAL,
    family: SpellFamily.WARRIOR,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
    minRange: 1,
    maxRange: 1,
    ...overrides,
  });
}

export function makeHealSpell(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return makeSpell({
    id: 'spell-heal',
    code: 'HEAL',
    name: 'Soin',
    damage: { min: 15, max: 25 },
    type: SpellType.HEAL,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.COMMON,
    effectKind: SpellEffectKind.HEAL,
    paCost: 3,
    ...overrides,
  });
}

export function makeBuffPaSpell(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return makeSpell({
    id: 'spell-buff-pm',
    code: 'BOOST_MOVEMENT',
    name: 'Boost',
    damage: { min: 0, max: 0 },
    type: SpellType.BUFF,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.COMMON,
    effectKind: SpellEffectKind.BUFF_PM,
    paCost: 2,
    minRange: 0,
    maxRange: 0,
    effectConfig: { value: 3, duration: 3 },
    ...overrides,
  });
}

export function makeSummonSpell(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return makeSpell({
    id: 'spell-summon',
    code: 'SUMMON_MENHIR',
    name: 'Menhir',
    damage: { min: 0, max: 0 },
    type: SpellType.BUFF,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.COMMON,
    effectKind: SpellEffectKind.SUMMON_MENHIR,
    paCost: 3,
    minRange: 1,
    maxRange: 3,
    effectConfig: { vit: 50, def: 20 },
    ...overrides,
  });
}

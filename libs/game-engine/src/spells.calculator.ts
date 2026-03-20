import { SpellDefinition, SpellType, SpellVisualType, ItemDefinition, ItemType } from '@game/shared-types';

export function calculatePlayerSpells(items: ItemDefinition[]): SpellDefinition[] {
  const allSpellIds = [
    'spell-frappe',
    'spell-bond',
    'spell-boule-de-feu',
    'spell-kunai',
    'spell-soin',
    'spell-endurance',
    'spell-menhir',
    'spell-bombe-repousse',
    'spell-velocite'
  ];
  
  const grantedSpells = items.flatMap(item => item.grantsSpells || []);
  
  // Si le joker '*' est présent, on donne tout
  if (grantedSpells.includes('*')) {
    return allSpellIds.map(id => getSpellDefinition(id, 3));
  }

  // Sinon uniquement les sorts spécifiés (dédupliqués)
  const uniqueSpellIds = Array.from(new Set(grantedSpells));
  return uniqueSpellIds.map(id => getSpellDefinition(id, 3));
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getSpellDefinition(id: string, level: number): SpellDefinition {
  switch (id) {
    case 'spell-frappe':
      return { id, name: 'Épée', paCost: 3, minRange: 1, maxRange: 1, damage: { min: 35, max: 45 }, cooldown: 0, type: SpellType.DAMAGE, visualType: SpellVisualType.PHYSICAL };
    case 'spell-bond':
      return { id, name: 'Bond', paCost: 4, minRange: 1, maxRange: 4, damage: { min: 0, max: 0 }, cooldown: 1, type: SpellType.BUFF, visualType: SpellVisualType.UTILITY };
    case 'spell-boule-de-feu':
      return { id, name: 'Boule de Feu', paCost: 3, minRange: 1, maxRange: 7, damage: { min: 20, max: 30 }, cooldown: 0, type: SpellType.DAMAGE, visualType: SpellVisualType.PROJECTILE };
    case 'spell-kunai':
        return { id, name: 'Kunaï', paCost: 2, minRange: 1, maxRange: 9, damage: { min: 15, max: 20 }, cooldown: 0, type: SpellType.DAMAGE, visualType: SpellVisualType.PROJECTILE };
    case 'spell-soin':
        return { id, name: 'Soin', paCost: 2, minRange: 0, maxRange: 4, damage: { min: 15, max: 25 }, cooldown: 1, type: SpellType.HEAL, visualType: SpellVisualType.UTILITY };
    case 'spell-endurance':
        return { id, name: 'Endurance', paCost: 2, minRange: 0, maxRange: 0, damage: { min: 0, max: 0 }, cooldown: 2, type: SpellType.BUFF, visualType: SpellVisualType.UTILITY };
    case 'spell-menhir':
        return { id, name: 'Menhir', paCost: 4, minRange: 1, maxRange: 3, damage: { min: 0, max: 0 }, cooldown: 1, type: SpellType.BUFF, visualType: SpellVisualType.PHYSICAL };
    case 'spell-bombe-repousse':
        return { id, name: 'Bombe', paCost: 4, minRange: 1, maxRange: 4, damage: { min: 0, max: 0 }, cooldown: 1, type: SpellType.DAMAGE, visualType: SpellVisualType.PROJECTILE };
    case 'spell-velocite':
        return { id, name: 'Vélocité', paCost: 2, minRange: 0, maxRange: 0, damage: { min: 0, max: 0 }, cooldown: 1, type: SpellType.BUFF, visualType: SpellVisualType.UTILITY };
    case 'spell-vol-de-vie':
        return { id, name: 'Vol de Vie', paCost: 3, minRange: 1, maxRange: 3, damage: { min: 20, max: 25 }, cooldown: 0, type: SpellType.DAMAGE, visualType: SpellVisualType.PHYSICAL };
    default:
        return { id, name: id, paCost: 3, minRange: 1, maxRange: 1, damage: { min: 5, max: 10 }, cooldown: 0, type: SpellType.DAMAGE, visualType: SpellVisualType.PHYSICAL };
  }
}

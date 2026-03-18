import { SpellDefinition, SpellType, ItemDefinition, ItemType } from '@game/shared-types';

export function calculatePlayerSpells(items: ItemDefinition[]): SpellDefinition[] {
  const spells: SpellDefinition[] = [];
  
  // Compter les sources pour chaque spell
  const sources: Record<string, number> = {
    'spell-frappe': 0,
    'spell-bond': 0,
    'spell-endurance': 0,
    'spell-menhir': 0,
    'spell-boule-de-feu': 0,
    'spell-kunai': 0,
    'spell-bombe-repousse': 0,
    'spell-velocite': 0,
    'spell-soin': 0,
  };

  const hasItem = (name: string) => {
    const search = normalize(name);
    return items.some(i => normalize(i.name).includes(search));
  };
  
  // Archétypes
  const hasFullSetGuerrier = hasItem('Heaume') && hasItem('Armure') && hasItem('Bottes de Fer');
  const hasFullSetMage = hasItem('Chapeau') && hasItem('Toge') && hasItem('Bottes de Mage');
  const hasFullSetNinja = hasItem('Bandeau') && hasItem('Kimono') && hasItem('Geta');

  // Armes & Combos
  const hasEpee = hasItem('Épée');
  const hasBouclier = hasItem('Bouclier');
  const hasBaton = hasItem('Bâton');
  const hasGrimoire = hasItem('Grimoire');
  const hasKunai = hasItem('Kunaï');
  const hasBombe = hasItem('Bombe');

  const hasAnneauGuerrier = hasItem('Anneau du Guerrier');
  const hasAnneauMage = hasItem('Anneau du Mage');
  const hasAnneauNinja = hasItem('Anneau du Ninja');

  // Frappe
  if (hasEpee) sources['spell-frappe'] += 1;

  // Bond
  if (hasEpee && hasBouclier) sources['spell-bond'] += 1;
  if (hasAnneauGuerrier) sources['spell-bond'] += 1;
  if (hasFullSetGuerrier) sources['spell-bond'] += 1;

  // Endurance
  if (hasBouclier) sources['spell-endurance'] += 1;
  if (hasAnneauGuerrier) sources['spell-endurance'] += 1;
  if (hasFullSetGuerrier) sources['spell-endurance'] += 1;

  // Menhir
  if (hasGrimoire) sources['spell-menhir'] += 1;
  if (hasAnneauMage) sources['spell-menhir'] += 1;
  if (hasFullSetMage) sources['spell-menhir'] += 1;

  // Boule de Feu
  if (hasBaton) sources['spell-boule-de-feu'] += 1;

  // Kunai
  if (hasKunai) sources['spell-kunai'] += 1;

  // Bombe de Repousse
  if (hasBombe) sources['spell-bombe-repousse'] += 1;
  if (hasAnneauNinja) sources['spell-bombe-repousse'] += 1;
  if (hasFullSetNinja) sources['spell-bombe-repousse'] += 1;

  // Vélocité
  if (hasKunai && hasBombe) sources['spell-velocite'] += 1;
  if (hasAnneauNinja) sources['spell-velocite'] += 1;
  if (hasFullSetNinja) sources['spell-velocite'] += 1;

  // Soin
  if (hasBaton && hasGrimoire) sources['spell-soin'] += 1;
  if (hasAnneauMage) sources['spell-soin'] += 1;
  if (hasFullSetMage) sources['spell-soin'] += 1;

  // Générer les SpellDefinitions
  for (const [id, count] of Object.entries(sources)) {
    if (count > 0) {
      const level = Math.min(3, count);
      spells.push(getSpellDefinition(id, level));
    }
  }

  return spells;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getSpellDefinition(id: string, level: number): SpellDefinition {
  switch (id) {
    case 'spell-frappe':
      return {
        id,
        name: 'Épée',
        paCost: 3,
        minRange: 1,
        maxRange: 1,
        damage: { min: [10, 15, 22][level - 1], max: [14, 20, 30][level - 1] },
        cooldown: 0,
        type: SpellType.DAMAGE
      };
    case 'spell-bond':
      return {
        id,
        name: 'Bond',
        paCost: 2,
        minRange: 1,
        maxRange: [2, 3, 4][level - 1],
        damage: { min: 0, max: 0 },
        cooldown: [2, 1, 0][level - 1],
        type: SpellType.BUFF // Mobilité
      };
    case 'spell-endurance':
      return {
        id,
        name: 'Endurance',
        paCost: 2,
        minRange: 0,
        maxRange: 0,
        damage: { min: 0, max: 0 },
        cooldown: [3, 3, 2][level - 1],
        type: SpellType.BUFF
      };
    case 'spell-boule-de-feu':
      return {
        id,
        name: 'Boule de Feu',
        paCost: 4,
        minRange: 1,
        maxRange: [5, 6, 7][level - 1],
        damage: { min: [12, 18, 25][level - 1], max: [20, 28, 35][level - 1] },
        cooldown: [1, 1, 0][level - 1],
        type: SpellType.DAMAGE
      };
    case 'spell-kunai':
        return {
          id,
          name: 'Lancer de Kunaï',
          paCost: 3,
          minRange: 1,
          maxRange: [4, 5, 6][level - 1],
          damage: { min: [8, 12, 16][level - 1], max: [14, 20, 24][level - 1] },
          cooldown: 0,
          type: SpellType.DAMAGE
        };
    // TODO: Implémenter les autres si nécessaire, mais on a les bases pour le playtest
    default:
        return {
            id,
            name: id,
            paCost: 3,
            minRange: 1,
            maxRange: 1,
            damage: { min: 5, max: 10 },
            cooldown: 0,
            type: SpellType.DAMAGE
        };
  }
}

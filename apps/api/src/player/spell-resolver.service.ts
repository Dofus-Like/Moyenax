import { Injectable } from '@nestjs/common';
import { Item, Spell, SpellFamily } from '@prisma/client';

@Injectable()
export class SpellResolverService {
  /**
   * T4.4.1 : resolveSpells(equipment)
   * Calcule les sorts accordés par un ensemble d'items, incluant combos et full sets.
   * Retourne une map [spellCode] -> level (nombre de sources)
   */
  resolveSpells(
    equippedItems: Item[],
    defaultSpells: Spell[],
    itemGrantedSpells: { itemId: string; spellId: string }[],
    allSpells: Spell[],
  ): Record<string, number> {
    const itemNames = equippedItems.map((it) => it.name);
    const itemIds = equippedItems.map((it) => it.id);
    const counts: Record<string, number> = {};

    // 1. Spells par défaut
    for (const s of defaultSpells) (counts[s.id] = (counts[s.id] || 0) + 1);

    // 2. Spells accordés par items (via ItemGrantedSpell)
    for (const g of itemGrantedSpells) {
      if (itemIds.includes(g.itemId)) {
        counts[g.spellId] = (counts[g.spellId] || 0) + 1;
      }
    }

    // 3. Combos (T4.4.2)
    const comboPairs = [
      { items: ['Épée', 'Bouclier'], spellCode: 'spell-bond' },
      { items: ['Bâton magique', 'Grimoire'], spellCode: 'spell-soin' },
      { items: ['Kunaï', 'Bombe ninja'], spellCode: 'spell-velocite' },
    ];

    for (const combo of comboPairs) {
      if (combo.items.every((name) => itemNames.includes(name))) {
        const spell = allSpells.find((s) => s.code === combo.spellCode);
        if (spell) counts[spell.id] = (counts[spell.id] || 0) + 1;
      }
    }

    // 4. Full Sets (T4.4.3) - Accorde +1 à TOUS les sorts de la famille
    const families = [
      {
        family: SpellFamily.WARRIOR,
        items: ['Heaume', 'Armure', 'Bottes de fer', 'Anneau du Guerrier'],
      },
      {
        family: SpellFamily.MAGE,
        items: ['Chapeau de mage', 'Toge de mage', 'Bottes de mage', 'Anneau du Mage'],
      },
      { family: SpellFamily.NINJA, items: ['Bandeau', 'Kimono', 'Geta', 'Anneau du Ninja'] },
    ];

    for (const set of families) {
      if (set.items.every((name) => itemNames.includes(name))) {
        const familySpells = allSpells.filter((s) => s.family === set.family);
        for (const s of familySpells) (counts[s.id] = (counts[s.id] || 0) + 1);
      }
    }

    return counts;
  }
}

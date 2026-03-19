import { Injectable } from '@nestjs/common';
import { EquipmentSlotType } from '@game/shared-types';

@Injectable()
export class SpellResolverService {
  resolveSpells(equipment: Record<string, any>): { spellName: string; level: number }[] {
    const spellLevels: Record<string, number> = {};

    const addSpell = (name: string) => {
      spellLevels[name] = Math.min((spellLevels[name] || 0) + 1, 3);
    };

    // 1. Spells directs des items
    Object.values(equipment).forEach((slot) => {
      const s = slot as any;
      if (s?.item?.grantsSpells) {
        const grants = s.item.grantsSpells as string[];
        grants.forEach((spellName: string) => addSpell(spellName));
      }
    });

    // 2. Combos
    const wpLeft = (equipment[EquipmentSlotType.WEAPON_LEFT] as any)?.item?.name;
    const wpRight = (equipment[EquipmentSlotType.WEAPON_RIGHT] as any)?.item?.name;

    // Épée + Bouclier -> Bond
    if (this.hasBoth(wpLeft, wpRight, 'Épée', 'Bouclier')) {
      addSpell('Bond');
    }
    // Bâton + Grimoire -> Soin
    if (this.hasBoth(wpLeft, wpRight, 'Bâton magique', 'Grimoire')) {
      addSpell('Soin');
    }
    // Kunaï + Bombe ninja -> Vélocité
    if (this.hasBoth(wpLeft, wpRight, 'Kunaï', 'Bombe ninja')) {
      addSpell('Vélocité');
    }

    // 3. Full Sets
    const head = (equipment[EquipmentSlotType.ARMOR_HEAD] as any)?.item?.name;
    const chest = (equipment[EquipmentSlotType.ARMOR_CHEST] as any)?.item?.name;
    const legs = (equipment[EquipmentSlotType.ARMOR_LEGS] as any)?.item?.name;

    // Guerrier : Heaume + Armure + Bottes de Fer
    if (this.isSet(head, chest, legs, 'Heaume', 'Armure', 'Bottes de Fer')) {
      addSpell('Bond');
      addSpell('Endurance');
    }
    // Mage : Chapeau de mage + Toge de mage + Bottes de mage
    if (this.isSet(head, chest, legs, 'Chapeau de mage', 'Toge de mage', 'Bottes de mage')) {
      addSpell('Menhir');
      addSpell('Soin');
    }
    // Ninja : Bandeau + Kimono + Geta
    if (this.isSet(head, chest, legs, 'Bandeau', 'Kimono', 'Geta')) {
      addSpell('Bombe de Repousse');
      addSpell('Vélocité');
    }

    // 4. Anneaux
    const accessory = (equipment[EquipmentSlotType.ACCESSORY] as any)?.item?.name;
    if (accessory === 'Anneau du Guerrier') {
      addSpell('Bond');
      addSpell('Endurance');
    }
    if (accessory === 'Anneau du Mage') {
      addSpell('Menhir');
      addSpell('Soin');
    }
    if (accessory === 'Anneau du Ninja') {
      addSpell('Bombe de Repousse');
      addSpell('Vélocité');
    }

    return Object.entries(spellLevels).map(([name, level]) => ({
      spellName: name,
      level,
    }));
  }

  private hasBoth(a: string | undefined, b: string | undefined, target1: string, target2: string) {
    return (a === target1 && b === target2) || (a === target2 && b === target1);
  }

  private isSet(h: string | undefined, c: string | undefined, l: string | undefined, th: string, tc: string, tl: string) {
    return h === th && c === tc && l === tl;
  }
}

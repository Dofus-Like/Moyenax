import { Injectable } from '@nestjs/common';
import { EquipmentSlotType } from '@game/shared-types';

@Injectable()
export class SpellResolverService {
  resolveSpells(equipment: Record<string, any>): { spellName: string; level: number }[] {
    const spellSources: Record<string, number> = {};
    const weaponSpells: Record<string, number> = {};

    const addArchetypeSource = (name: string) => {
      spellSources[name] = (spellSources[name] || 0) + 1;
    };

    const setWeaponSpell = (name: string, level: number) => {
      weaponSpells[name] = Math.max(weaponSpells[name] || 0, level);
    };

    // 1. Spells directs des items (Armes)
    Object.values(equipment).forEach((slot) => {
      const s = slot as any;
      if (s?.item?.grantsSpells) {
        const grants = s.item.grantsSpells as string[];
        const rank = s.inventoryItem?.rank || 1;
        grants.forEach((spellName: string) => setWeaponSpell(spellName, rank));
      }
    });

    // 2. Combos Armes
    const slotLeft = equipment[EquipmentSlotType.WEAPON_LEFT] as any;
    const slotRight = equipment[EquipmentSlotType.WEAPON_RIGHT] as any;
    const wpLeft = slotLeft?.item?.name;
    const wpRight = slotRight?.item?.name;

    // Épée + Bouclier -> Guerrier
    if (this.hasBoth(wpLeft, wpRight, 'Épée', 'Bouclier')) {
      addArchetypeSource('Bond');
      addArchetypeSource('Endurance');
    }
    // Bâton + Grimoire -> Mage
    if (this.hasBoth(wpLeft, wpRight, 'Bâton magique', 'Grimoire')) {
      addArchetypeSource('Menhir');
      addArchetypeSource('Soin');
    }
    // Kunaï + Bombe ninja -> Ninja
    if (this.hasBoth(wpLeft, wpRight, 'Kunaï', 'Bombe ninja')) {
      addArchetypeSource('Bombe de Repousse');
      addArchetypeSource('Vélocité');
    }

    // 3. Full Sets
    const head = (equipment[EquipmentSlotType.ARMOR_HEAD] as any)?.item?.name;
    const chest = (equipment[EquipmentSlotType.ARMOR_CHEST] as any)?.item?.name;
    const legs = (equipment[EquipmentSlotType.ARMOR_LEGS] as any)?.item?.name;

    // Guerrier
    if (this.isSet(head, chest, legs, 'Heaume', 'Armure', 'Bottes de fer')) {
      addArchetypeSource('Bond');
      addArchetypeSource('Endurance');
    }
    // Mage
    if (this.isSet(head, chest, legs, 'Chapeau de mage', 'Toge de mage', 'Bottes de mage')) {
      addArchetypeSource('Menhir');
      addArchetypeSource('Soin');
    }
    // Ninja
    if (this.isSet(head, chest, legs, 'Bandeau', 'Kimono', 'Geta')) {
      addArchetypeSource('Bombe de Repousse');
      addArchetypeSource('Vélocité');
    }

    // 4. Anneaux
    const accessory = (equipment[EquipmentSlotType.ACCESSORY] as any)?.item?.name;
    if (accessory === 'Anneau du Guerrier') {
      addArchetypeSource('Bond');
      addArchetypeSource('Endurance');
    }
    if (accessory === 'Anneau du Mage') {
      addArchetypeSource('Menhir');
      addArchetypeSource('Soin');
    }
    if (accessory === 'Anneau du Ninja') {
      addArchetypeSource('Bombe de Repousse');
      addArchetypeSource('Vélocité');
    }

    // Fusionner les résultats
    const finalSpells: { spellName: string; level: number }[] = [];

    // Ajouter les sorts d'armes
    Object.entries(weaponSpells).forEach(([name, level]) => {
      finalSpells.push({ spellName: name, level: Math.min(level, 3) });
    });

    // Ajouter les sorts d'archétype
    Object.entries(spellSources).forEach(([name, sources]) => {
      finalSpells.push({ spellName: name, level: Math.min(sources, 3) });
    });

    return finalSpells;
  }

  private hasBoth(a: string | undefined, b: string | undefined, target1: string, target2: string) {
    return (a === target1 && b === target2) || (a === target2 && b === target1);
  }

  private isSet(h: string | undefined, c: string | undefined, l: string | undefined, th: string, tc: string, tl: string) {
    return h === th && c === tc && l === tl;
  }
}

import { Injectable } from '@nestjs/common';
import { EquipmentSlotType } from '@game/shared-types';

@Injectable()
export class SpellResolverService {
  resolveSpells(equipment: Record<string, any>): { spellName: string; level: number }[] {
    const spellSet = new Set<string>();
    const ALL_SPELLS = [
      'spell-frappe', 'spell-bond', 'spell-endurance',
      'spell-boule-de-feu', 'spell-menhir', 'spell-soin',
      'spell-kunai', 'spell-bombe-repousse', 'spell-velocite'
    ];

    Object.values(equipment).forEach((slot) => {
      const s = slot as any;
      if (s?.item?.grantsSpells) {
        const grants = s.item.grantsSpells as string[];
        grants.forEach((slug: string) => {
          if (slug === '*') {
            ALL_SPELLS.forEach(id => spellSet.add(id));
          } else {
            spellSet.add(slug);
          }
        });
      }
    });

    return Array.from(spellSet).map(slug => ({
      spellName: slug,
      level: 3 // On fixe tout au rang max pour le moment
    }));
  }

  private hasBoth(a: string | undefined, b: string | undefined, target1: string, target2: string) {
    return (a === target1 && b === target2) || (a === target2 && b === target1);
  }

  private isSet(h: string | undefined, c: string | undefined, l: string | undefined, th: string, tc: string, tl: string) {
    return h === th && c === tc && l === tl;
  }
}

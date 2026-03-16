import { Injectable } from '@nestjs/common';
import { CombatState, CombatPlayer, SpellDefinition, SpellType } from '@game/shared-types';
import { calculateDamage } from '@game/game-engine';

@Injectable()
export class SpellsService {
  resolveSpellEffect(
    spell: SpellDefinition,
    caster: CombatPlayer,
    target: CombatPlayer,
    state: CombatState,
  ): CombatState {
    const updatedState = { ...state };

    switch (spell.type) {
      case SpellType.DAMAGE: {
        const damage = calculateDamage(spell, caster.stats);
        const targetPlayer = updatedState.players[target.playerId];
        targetPlayer.stats.hp = Math.max(0, targetPlayer.stats.hp - damage);
        break;
      }

      case SpellType.HEAL: {
        const healAmount = calculateDamage(spell, caster.stats);
        const healTarget = updatedState.players[target.playerId];
        healTarget.stats.hp = Math.min(healTarget.stats.maxHp, healTarget.stats.hp + healAmount);
        break;
      }

      case SpellType.BUFF: {
        const buffTarget = updatedState.players[target.playerId];
        buffTarget.stats.strength += 2;
        buffTarget.stats.agility += 2;
        break;
      }
    }

    return updatedState;
  }
}

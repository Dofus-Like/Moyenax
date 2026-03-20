import { Injectable } from '@nestjs/common';
import type { CombatState, CombatPlayer, SpellDefinition } from '@game/shared-types';

@Injectable()
export class SpellsService {
  /**
   * Resolve generic spell effects. 
   * Note: Most logic is currently handled in TurnService.
   */
  resolveSpellEffect(
    spell: SpellDefinition,
    caster: CombatPlayer,
    target: CombatPlayer,
    state: CombatState,
  ): CombatState {
    return state;
  }
}

export declare const GAME_EVENTS: {
  readonly ITEM_EQUIPPED: 'player.item.equipped';
  readonly ITEM_UNEQUIPPED: 'player.item.unequipped';
  readonly SPELL_LEARNED: 'player.spell.learned';
  readonly COMBAT_ENDED: 'combat.ended';
  readonly COMBAT_PLAYER_DIED: 'combat.player.died';
};
export type GameEventKey = keyof typeof GAME_EVENTS;
export type GameEventValue = (typeof GAME_EVENTS)[GameEventKey];

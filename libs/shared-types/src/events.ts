export const GAME_EVENTS = {
  // Émis par Équipe A, consommés par Équipe B
  ITEM_EQUIPPED: 'player.item.equipped',
  ITEM_UNEQUIPPED: 'player.item.unequipped',
  SPELL_LEARNED: 'player.spell.learned',
  // Émis par Équipe B, consommés par Équipe A
  COMBAT_ENDED: 'combat.ended',
  COMBAT_PLAYER_DIED: 'combat.player.died',
  TURN_STARTED: 'combat.turn.started',
} as const;

export type GameEventKey = keyof typeof GAME_EVENTS;
export type GameEventValue = (typeof GAME_EVENTS)[GameEventKey];

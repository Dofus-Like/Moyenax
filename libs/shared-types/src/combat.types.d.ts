import { PlayerStats } from './player.types';
export interface CombatPosition {
    x: number;
    y: number;
}
export interface SpellDefinition {
    id: string;
    name: string;
    apCost: number;
    minRange: number;
    maxRange: number;
    damage: {
        min: number;
        max: number;
    };
    cooldown: number;
    type: SpellType;
}
export declare enum SpellType {
    DAMAGE = "DAMAGE",
    HEAL = "HEAL",
    BUFF = "BUFF"
}
export interface CombatPlayer {
    playerId: string;
    stats: PlayerStats;
    position: CombatPosition;
    spells: SpellDefinition[];
    remainingAp: number;
    remainingMp: number;
    spellCooldowns: Record<string, number>;
}
export declare enum CombatActionType {
    MOVE = "MOVE",
    CAST_SPELL = "CAST_SPELL",
    END_TURN = "END_TURN"
}
export interface CombatAction {
    type: CombatActionType;
    spellId?: string;
    targetX?: number;
    targetY?: number;
}
export interface CombatState {
    sessionId: string;
    currentTurnPlayerId: string;
    turnNumber: number;
    players: Record<string, CombatPlayer>;
    map: {
        width: number;
        height: number;
        obstacles: CombatPosition[];
    };
}

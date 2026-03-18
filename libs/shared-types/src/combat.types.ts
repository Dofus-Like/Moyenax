import { PlayerStats } from './player.types';
import { TerrainType } from './map.types';

export interface CombatPosition {
  x: number;
  y: number;
}

export interface SpellDefinition {
  id: string;
  name: string;
  paCost: number;     // Renamed from apCost
  minRange: number;
  maxRange: number;
  damage: { min: number; max: number };
  cooldown: number;
  type: SpellType;
}

export enum SpellType {
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  BUFF = 'BUFF',
}


export interface Tile {
  x: number;
  y: number;
  type: TerrainType;
}

export interface CombatPlayer {
  playerId: string;
  stats: PlayerStats;
  position: CombatPosition;
  spells: SpellDefinition[];
  remainingPa: number;
  remainingPm: number;
  currentVit: number;      // Pour suivre les dégâts séparément des stats de base
  spellCooldowns: Record<string, number>;
}

export enum CombatActionType {
  MOVE = 'MOVE',
  JUMP = 'JUMP',
  CAST_SPELL = 'CAST_SPELL',
  END_TURN = 'END_TURN',
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
    tiles: Tile[];
  };
}

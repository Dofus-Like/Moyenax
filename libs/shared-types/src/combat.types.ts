import { PlayerStats } from './player.types';
import { TerrainType } from './map.types';

export interface CombatPosition {
  x: number;
  y: number;
}

export enum SpellType {
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  BUFF = 'BUFF',
}

export enum SpellVisualType {
  PHYSICAL = 'PHYSICAL',
  PROJECTILE = 'PROJECTILE',
  UTILITY = 'UTILITY',
}

export interface SpellDefinition {
  id: string;
  name: string;
  paCost: number;     
  minRange: number;
  maxRange: number;
  damage: { min: number; max: number };
  cooldown: number;
  type: SpellType;
  visualType: SpellVisualType;
}


export interface Tile {
  x: number;
  y: number;
  type: TerrainType;
}

export interface Buff {
  type: 'PA' | 'PM' | 'DEF' | 'RES' | 'VIT_MAX';
  value: number;
  remainingTurns: number;
}

export interface CombatPlayer {
  playerId: string;
  username: string;
  type: 'PLAYER' | 'SUMMON';
  stats: PlayerStats;
  position: CombatPosition;
  spells: SpellDefinition[];
  remainingPa: number;
  remainingPm: number;
  currentVit: number;      
  spellCooldowns: Record<string, number>;
  buffs: Buff[];
  skin?: string;
}

export enum CombatActionType {
  MOVE = 'MOVE',
  JUMP = 'JUMP',
  CAST_SPELL = 'CAST_SPELL',
  END_TURN = 'END_TURN',
  SURRENDER = 'SURRENDER',
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
  winnerId?: string; // Ajout du gagnant
}

import type { TerrainType } from './map.types';
import type { PlayerStats } from './player.types';
export interface CombatPosition {
  x: number;
  y: number;
}
export declare enum SpellType {
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  BUFF = 'BUFF',
}
export declare enum SpellVisualType {
  PHYSICAL = 'PHYSICAL',
  PROJECTILE = 'PROJECTILE',
  UTILITY = 'UTILITY',
}
export declare enum SpellFamily {
  COMMON = 'COMMON',
  WARRIOR = 'WARRIOR',
  MAGE = 'MAGE',
  NINJA = 'NINJA',
}
export declare enum SpellEffectKind {
  DAMAGE_PHYSICAL = 'DAMAGE_PHYSICAL',
  DAMAGE_MAGICAL = 'DAMAGE_MAGICAL',
  HEAL = 'HEAL',
  TELEPORT = 'TELEPORT',
  BUFF_VIT_MAX = 'BUFF_VIT_MAX',
  SUMMON_MENHIR = 'SUMMON_MENHIR',
  PUSH_LINE = 'PUSH_LINE',
  BUFF_PM = 'BUFF_PM',
}
export interface SpellDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  paCost: number;
  minRange: number;
  maxRange: number;
  damage: {
    min: number;
    max: number;
  };
  cooldown: number;
  type: SpellType;
  visualType: SpellVisualType;
  family: SpellFamily;
  iconPath: string | null;
  sortOrder: number;
  requiresLineOfSight: boolean;
  requiresLinearTargeting: boolean;
  effectKind: SpellEffectKind;
  effectConfig: Record<string, unknown> | null;
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
export declare enum CombatActionType {
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
  winnerId?: string;
}

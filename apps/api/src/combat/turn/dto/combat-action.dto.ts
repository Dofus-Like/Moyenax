import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CombatActionType } from '@game/shared-types';

/**
 * DTO de validation pour CombatAction.
 * Avant: le controller acceptait n'importe quel payload typé CombatAction sans validation,
 * permettant des valeurs hors limites (targetX=-999999, sessionId non-string, etc).
 * Ce DTO applique class-validator avec bornes conservatrices (map max théorique 100x100).
 */
export class CombatActionDto {
  @IsEnum(CombatActionType)
  type!: CombatActionType;

  @IsOptional()
  @IsString()
  spellId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  targetX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  targetY?: number;
}

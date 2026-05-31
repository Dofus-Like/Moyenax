import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { SpellType, SpellVisualType, SpellFamily, SpellEffectKind } from '@game/shared-types';

class DamageRange {
  @IsInt()
  @Min(0)
  @Max(9999)
  min!: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  max!: number;
}

export class CreateSpellDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(0)
  @Max(12)
  paCost!: number;

  @IsInt()
  @Min(0)
  @Max(20)
  minRange!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  maxRange!: number;

  @ValidateNested()
  @Type(() => DamageRange)
  damage!: DamageRange;

  @IsInt()
  @Min(0)
  @Max(10)
  cooldown!: number;

  @IsEnum(SpellType)
  type!: SpellType;

  @IsEnum(SpellVisualType)
  visualType!: SpellVisualType;

  @IsEnum(SpellFamily)
  family!: SpellFamily;

  @IsOptional()
  @IsString()
  iconPath?: string;

  @IsInt()
  sortOrder!: number;

  @IsBoolean()
  requiresLineOfSight!: boolean;

  @IsBoolean()
  requiresLinearTargeting!: boolean;

  @IsEnum(SpellEffectKind)
  effectKind!: SpellEffectKind;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  effectConfig?: Record<string, unknown> | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SpellEffectEntryDto)
  @ArrayMinSize(1)
  effects?: SpellEffectEntryDto[];
}

export class SpellEffectEntryDto {
  @IsEnum(SpellEffectKind)
  kind!: SpellEffectKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  duration?: number;

  @IsOptional()
  config?: Record<string, unknown>;
}

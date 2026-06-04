import { EquipmentSlotType, TerrainType } from '@game/shared-types';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PaintTileDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;

  @IsEnum(TerrainType)
  terrain!: TerrainType;
}

export class GatherTileDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}

export class GrantEquipDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsEnum(EquipmentSlotType)
  slot!: EquipmentSlotType;
}

export class UnequipDto {
  @IsEnum(EquipmentSlotType)
  slot!: EquipmentSlotType;
}

export class AddDummyDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}

export class SetDummyDto {
  @IsString()
  @IsNotEmpty()
  dummyId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  vit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  def?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  res?: number;
}

export class SetPlayerStatsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9_999_999)
  vit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  atk?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  mag?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  def?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  res?: number;
}

export class NoCooldownDto {
  @IsBoolean()
  enabled!: boolean;
}

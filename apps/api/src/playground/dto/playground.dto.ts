import { EquipmentSlotType, TerrainType } from '@game/shared-types';
import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

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

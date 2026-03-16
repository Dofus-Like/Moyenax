import { IsUUID, IsInt, Min } from 'class-validator';

export class SellItemDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

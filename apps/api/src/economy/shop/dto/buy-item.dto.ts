import { IsUUID, IsInt, Min } from 'class-validator';

export class BuyItemDto {
  @IsUUID()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

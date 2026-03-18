import { IsInt, IsNotEmpty } from 'class-validator';

export class GatherResourceDto {
  @IsInt()
  @IsNotEmpty()
  targetX = 0;

  @IsInt()
  @IsNotEmpty()
  targetY = 0;

  @IsInt()
  @IsNotEmpty()
  playerX = 0;

  @IsInt()
  @IsNotEmpty()
  playerY = 0;
}

import { IsString, IsNotEmpty } from 'class-validator';

export class QuickVsAiDto {
  @IsString()
  @IsNotEmpty()
  ringId!: string;
}

import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ALLOWED_PLAYER_CLASSES } from '../../shared/security/security.constants';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(ALLOWED_PLAYER_CLASSES)
  selectedClass!: string;
}

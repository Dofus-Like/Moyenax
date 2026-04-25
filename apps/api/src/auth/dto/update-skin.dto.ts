import { IsIn } from 'class-validator';

import { ALLOWED_SKINS } from '../../shared/security/security.constants';

export class UpdateSkinDto {
  @IsIn(ALLOWED_SKINS)
  skin!: string;
}

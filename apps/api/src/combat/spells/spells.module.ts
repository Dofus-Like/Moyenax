import { Module } from '@nestjs/common';

import { PrismaModule } from '../../shared/prisma/prisma.module';
import { SpellsController } from './spells.controller';
import { SpellsService } from './spells.service';

@Module({
  imports: [PrismaModule],
  controllers: [SpellsController],
  providers: [SpellsService],
  exports: [SpellsService],
})
export class SpellsModule {}

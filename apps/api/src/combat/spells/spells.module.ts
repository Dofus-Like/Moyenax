import { Module } from '@nestjs/common';
import { SpellsService } from './spells.service';

@Module({
  providers: [SpellsService],
  exports: [SpellsService],
})
export class SpellsModule {}

import { Module } from '@nestjs/common';

import { GameSessionModule } from '../../game-session/game-session.module';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [GameSessionModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}

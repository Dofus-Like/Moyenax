import { Module } from '@nestjs/common';

import { GameSessionModule } from '../../game-session/game-session.module';

import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  imports: [GameSessionModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}

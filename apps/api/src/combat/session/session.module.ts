import { Module } from '@nestjs/common';

import { PlayerModule } from '../../player/player.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { SecurityModule } from '../../shared/security/security.module';
import { SseModule } from '../../shared/sse/sse.module';
import { MapModule } from '../map/map.module';

import { SessionController } from './session.controller';
import { SessionDebugController } from './session.debug.controller';
import { SessionService } from './session.service';

const debugControllers = process.env.ENABLE_DEBUG_ROUTES === 'true' ? [SessionDebugController] : [];

@Module({
  imports: [PrismaModule, RedisModule, SecurityModule, SseModule, PlayerModule, MapModule],
  controllers: [SessionController, ...debugControllers],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

import { AppThrottlerGuard } from './app-throttler.guard';
import { DistributedLockService } from './distributed-lock.service';
import { MatchmakingQueueStore } from './matchmaking-queue.store';
import { SessionSecurityService } from './session-security.service';
import { SseTicketGuard } from './sse-ticket.guard';
import { SseTicketService } from './sse-ticket.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    AppThrottlerGuard,
    DistributedLockService,
    MatchmakingQueueStore,
    SessionSecurityService,
    SseTicketGuard,
    SseTicketService,
  ],
  exports: [
    AppThrottlerGuard,
    DistributedLockService,
    MatchmakingQueueStore,
    SessionSecurityService,
    SseTicketGuard,
    SseTicketService,
  ],
})
export class SecurityModule {}

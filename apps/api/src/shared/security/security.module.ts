import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AppThrottlerGuard } from './app-throttler.guard';
import { SessionSecurityService } from './session-security.service';
import { SseTicketGuard } from './sse-ticket.guard';
import { SseTicketService } from './sse-ticket.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    AppThrottlerGuard,
    SessionSecurityService,
    SseTicketGuard,
    SseTicketService,
  ],
  exports: [
    AppThrottlerGuard,
    SessionSecurityService,
    SseTicketGuard,
    SseTicketService,
  ],
})
export class SecurityModule {}

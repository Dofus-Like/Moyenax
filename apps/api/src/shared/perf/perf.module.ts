import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DebugPerfController } from './debug-perf.controller';
import { HttpPerfInterceptor } from './http-perf.interceptor';
import { PerfLoggerService } from './perf-logger.service';
import { PerfStatsService } from './perf-stats.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import { RuntimePerfService } from './runtime-perf.service';

@Global()
@Module({
  controllers: [DebugPerfController],
  providers: [
    PerfLoggerService,
    PerfStatsService,
    RuntimePerfService,
    RequestContextService,
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpPerfInterceptor,
    },
  ],
  exports: [
    PerfLoggerService,
    PerfStatsService,
    RuntimePerfService,
    RequestContextService,
    RequestContextMiddleware,
  ],
})
export class PerfModule {}

import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpPerfInterceptor } from './http-perf.interceptor';
import { PerfLoggerService } from './perf-logger.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import { RuntimePerfService } from './runtime-perf.service';

@Global()
@Module({
  providers: [
    PerfLoggerService,
    RuntimePerfService,
    RequestContextService,
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpPerfInterceptor,
    },
  ],
  exports: [PerfLoggerService, RuntimePerfService, RequestContextService, RequestContextMiddleware],
})
export class PerfModule {}

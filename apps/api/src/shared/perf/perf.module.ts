import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpPerfInterceptor } from './http-perf.interceptor';
import { PerfLoggerService } from './perf-logger.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [
    PerfLoggerService,
    RequestContextService,
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpPerfInterceptor,
    },
  ],
  exports: [PerfLoggerService, RequestContextService, RequestContextMiddleware],
})
export class PerfModule {}

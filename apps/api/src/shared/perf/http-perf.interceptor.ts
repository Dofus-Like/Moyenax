import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { PerfLoggerService } from './perf-logger.service';
import { PerfStatsService } from './perf-stats.service';
import { RequestContextService } from './request-context.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

@Injectable()
export class HttpPerfInterceptor implements NestInterceptor {
  constructor(
    private readonly perfLogger: PerfLoggerService,
    private readonly perfStats: PerfStatsService,
    private readonly requestContext: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const routePath = this.getRoutePath(req);
    const startedAt = performance.now();

    this.requestContext.patch({
      path: routePath,
      userId: req.user?.id,
    });

    const requestId = this.requestContext.get()?.requestId;
    if (requestId) {
      this.perfStats.startTrace(requestId, req.method, routePath);
    }

    return next.handle().pipe(
      finalize(() => {
        const durationMs = performance.now() - startedAt;
        const slow = durationMs >= 100;
        this.perfStats.recordHttp(req.method, routePath, durationMs, res.statusCode, slow, requestId);
        if (requestId) {
          this.perfStats.finishTrace(requestId, res.statusCode, durationMs);
        }

        if (!res.headersSent) {
          const existing = res.getHeader('Server-Timing');
          const entry = `app;dur=${durationMs.toFixed(2)}`;
          res.setHeader('Server-Timing', existing ? `${existing as string}, ${entry}` : entry);
        }

        this.perfLogger.logDuration('http', `${req.method} ${routePath}`, durationMs, {
          method: req.method,
          path: routePath,
          status_code: res.statusCode,
          user_id: req.user?.id,
        });
      }),
    );
  }

  private getRoutePath(req: AuthenticatedRequest): string {
    const routePath = req.route?.path;
    if (!routePath) {
      return req.originalUrl ?? req.url;
    }

    return `${req.baseUrl ?? ''}${routePath}`;
  }
}

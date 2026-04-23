import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { PerfLoggerService } from './perf-logger.service';
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

    return next.handle().pipe(
      finalize(() => {
        this.perfLogger.logDuration(
          'http',
          `${req.method} ${routePath}`,
          performance.now() - startedAt,
          {
            method: req.method,
            path: routePath,
            status_code: res.statusCode,
            user_id: req.user?.id,
          },
        );
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

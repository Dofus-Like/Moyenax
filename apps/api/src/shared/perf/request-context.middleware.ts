import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const headerValue = req.header('x-request-id');
    const requestId = headerValue && headerValue.trim().length > 0 ? headerValue : randomUUID();

    res.setHeader('x-request-id', requestId);

    this.requestContext.run(
      {
        requestId,
        method: req.method,
        path: req.originalUrl ?? req.url,
      },
      () => next(),
    );
  }
}

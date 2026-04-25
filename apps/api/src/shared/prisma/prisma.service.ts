import { performance } from 'node:perf_hooks';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { PerfLoggerService } from '../perf/perf-logger.service';
import { PerfStatsService } from '../perf/perf-stats.service';
import { RequestContextService } from '../perf/request-context.service';

function isDebugEnabled(): boolean {
  const flag = (process.env.SHOW_DEBUG ?? '').toLowerCase().trim();
  return flag === '1' || flag === 'true' || flag === 'on' || flag === 'yes';
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(
    private readonly perfLogger: PerfLoggerService,
    private readonly perfStats: PerfStatsService,
    private readonly requestContext: RequestContextService,
  ) {
    super(
      isDebugEnabled()
        ? { log: [{ emit: 'event', level: 'query' }] }
        : {},
    );

    this.$use(async (params: any, next: any) => {
      const startedAt = performance.now();
      try {
        return await next(params);
      } finally {
        const durationMs = performance.now() - startedAt;
        const model = params.model ?? 'raw';
        this.perfStats.recordPrisma(model, params.action, durationMs);
        const requestId = this.requestContext.get()?.requestId;
        if (requestId) {
          this.perfStats.pushTraceQuery(requestId, model, params.action, durationMs);
        }
        this.perfLogger.logDuration('prisma', `${model}.${params.action}`, durationMs, {
          db_model: model,
          db_action: params.action,
        });
      }
    });

    if (isDebugEnabled()) {
      (this as unknown as { $on: (event: 'query', cb: (e: { query: string; params: string; duration: number }) => void) => void }).$on(
        'query',
        (event) => {
          let parsedParams: unknown[] = [];
          try {
            const parsed = JSON.parse(event.params);
            if (Array.isArray(parsed)) parsedParams = parsed;
          } catch {
            // params may not be valid JSON (e.g. bytea) — keep empty array
          }
          this.perfStats.recordRawQuery(event.query, parsedParams, event.duration);
        },
      );
    }
  }

  async explainSelect(sql: string, params: unknown[]): Promise<unknown> {
    const trimmed = stripLeadingComments(sql).trim();
    if (!/^select\b/i.test(trimmed)) {
      throw new Error('EXPLAIN is only allowed on SELECT statements');
    }
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(explainSql, ...params);
      return rows;
    });
  }

  async onModuleInit(): Promise<void> {
    const startedAt = performance.now();
    await this.$connect();
    this.perfLogger.logDuration('bootstrap', 'prisma.connect', performance.now() - startedAt, {
      stage: 'connect',
    });
  }
}

function stripLeadingComments(sql: string): string {
  let s = sql.trim();
  while (true) {
    if (s.startsWith('--')) {
      const nl = s.indexOf('\n');
      s = nl === -1 ? '' : s.slice(nl + 1).trim();
    } else if (s.startsWith('/*')) {
      const end = s.indexOf('*/');
      s = end === -1 ? '' : s.slice(end + 2).trim();
    } else {
      break;
    }
  }
  return s;
}

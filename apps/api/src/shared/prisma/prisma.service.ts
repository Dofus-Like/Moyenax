import { Injectable, OnModuleInit } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';
import { PerfLoggerService } from '../perf/perf-logger.service';



@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly perfLogger: PerfLoggerService) {
    super();

    this.$use(async (params, next) => {
      const startedAt = performance.now();
      try {
        return await next(params);
      } finally {
        this.perfLogger.logDuration('prisma', `${params.model ?? 'raw'}.${params.action}`, performance.now() - startedAt, {
          db_model: params.model ?? 'raw',
          db_action: params.action,
        });
      }
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

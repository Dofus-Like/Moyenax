import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../shared/prisma/prisma.service';
import { RedisService } from '../shared/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    try {
      await Promise.all([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown dependency failure';

      throw new ServiceUnavailableException({
        status: 'error',
        message,
      });
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      services: {
        database: 'ok',
        redis: 'ok',
      },
    };
  }
}

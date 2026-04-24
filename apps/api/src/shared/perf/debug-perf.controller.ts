import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { PerfStatsService } from './perf-stats.service';
import { RuntimePerfService } from './runtime-perf.service';

function isDebugEnabled(): boolean {
  const flag = (process.env.SHOW_DEBUG ?? '').toLowerCase().trim();
  return flag === '1' || flag === 'true' || flag === 'on' || flag === 'yes';
}

@SkipThrottle()
@Controller('debug/perf')
export class DebugPerfController {
  constructor(
    private readonly perfStats: PerfStatsService,
    private readonly runtimePerf: RuntimePerfService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getSnapshot() {
    if (!isDebugEnabled()) {
      throw new ForbiddenException('debug perf endpoint disabled (set SHOW_DEBUG=1)');
    }

    const memory = process.memoryUsage();
    return {
      ts: new Date().toISOString(),
      runtime: {
        ...this.runtimePerf.getLiveSnapshot(),
        rssMb: Number((memory.rss / (1024 * 1024)).toFixed(2)),
        heapUsedMb: Number((memory.heapUsed / (1024 * 1024)).toFixed(2)),
        heapTotalMb: Number((memory.heapTotal / (1024 * 1024)).toFixed(2)),
        nodeVersion: process.version,
        pid: process.pid,
        uptimeSec: Math.round(process.uptime()),
      },
      totals: this.perfStats.getTotals(),
      routes: this.perfStats.getRoutesSnapshot(20),
      prisma: this.perfStats.getPrismaSnapshot(15),
      rawQueries: this.perfStats.getRawQueriesSnapshot(20),
      gameMetrics: this.perfStats.getGameMetricsSnapshot(30),
      redis: this.perfStats.getRedisSnapshot(30),
      recent: this.perfStats.getRecentRequests(),
    };
  }

  @Post('explain')
  async explain(@Body() body: { id?: string; sql?: string; params?: unknown[] }) {
    if (!isDebugEnabled()) {
      throw new ForbiddenException('debug perf endpoint disabled (set SHOW_DEBUG=1)');
    }

    let sql: string | undefined;
    let params: unknown[] = [];
    if (body.id) {
      const bucket = this.perfStats.getRawQuery(body.id);
      if (!bucket) throw new NotFoundException(`Unknown query id ${body.id}`);
      sql = bucket.sql;
      params = bucket.lastParams ?? [];
    } else if (body.sql) {
      sql = body.sql;
      params = Array.isArray(body.params) ? body.params : [];
    }

    if (!sql) {
      throw new BadRequestException('Provide { id } or { sql, params }');
    }

    try {
      const plan = await this.prisma.explainSelect(sql, params);
      return { sql, params, plan };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'EXPLAIN failed';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('trace/:id')
  getTrace(@Param('id') id: string) {
    if (!isDebugEnabled()) {
      throw new ForbiddenException('debug perf endpoint disabled (set SHOW_DEBUG=1)');
    }
    const trace = this.perfStats.getTrace(id);
    if (!trace) {
      throw new NotFoundException(`No trace for request ${id}`);
    }
    return trace;
  }

  @Post('reset')
  reset() {
    if (!isDebugEnabled()) {
      throw new ForbiddenException('debug perf endpoint disabled (set SHOW_DEBUG=1)');
    }
    this.perfStats.reset();
    return { reset: true, at: new Date().toISOString() };
  }
}

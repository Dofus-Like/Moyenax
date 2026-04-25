import { performance } from 'node:perf_hooks';

import { Injectable } from '@nestjs/common';

interface RollingSample {
  duration: number;
  slow: boolean;
  statusCode?: number;
  at: number;
}

interface RouteBucket {
  key: string;
  method: string;
  path: string;
  count: number;
  errorCount: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  samples: RollingSample[];
}

interface PrismaBucket {
  key: string;
  model: string;
  action: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  samples: number[];
}

export interface RouteStat {
  key: string;
  method: string;
  path: string;
  count: number;
  errorCount: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface PrismaStat {
  key: string;
  model: string;
  action: string;
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  p95: number;
}

export interface RawQueryStat {
  id: string;
  sql: string;
  lastParams: unknown[];
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  p95: number;
  lastAt: number;
}

export interface RecentRequest {
  method: string;
  path: string;
  statusCode?: number;
  durationMs: number;
  slow: boolean;
  at: number;
  requestId?: string;
}

export interface TraceQuery {
  model: string;
  action: string;
  durationMs: number;
  at: number;
}

export interface RequestTrace {
  requestId: string;
  method: string;
  path: string;
  statusCode?: number;
  totalMs?: number;
  startedAt: number;
  queries: TraceQuery[];
}

const MAX_SAMPLES_PER_ROUTE = 200;
const MAX_RECENT_REQUESTS = 50;
const MAX_TRACES = 100;
const MAX_QUERIES_PER_TRACE = 100;

interface MetricBucket {
  key: string;
  scope: string;
  name: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  samples: number[];
}

interface RawQueryBucket {
  id: string;
  sql: string;
  lastParams: unknown[];
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  lastAt: number;
  samples: number[];
}

interface RedisBucket {
  key: string;
  command: string;
  prefix: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  samples: number[];
  hits?: number;
  misses?: number;
}

export interface GameMetricStat {
  key: string;
  scope: string;
  name: string;
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  p95: number;
}

export interface RedisStat {
  key: string;
  command: string;
  prefix: string;
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  p95: number;
  hits: number;
  misses: number;
  hitRate: number | null;
}

@Injectable()
export class PerfStatsService {
  private readonly routes = new Map<string, RouteBucket>();
  private readonly prisma = new Map<string, PrismaBucket>();
  private readonly rawQueries = new Map<string, RawQueryBucket>();
  private readonly gameMetrics = new Map<string, MetricBucket>();
  private readonly redisOps = new Map<string, RedisBucket>();
  private readonly recent: RecentRequest[] = [];
  private readonly traces = new Map<string, RequestTrace>();
  private readonly traceOrder: string[] = [];
  private readonly startedAt = performance.now();
  private totalRequests = 0;
  private totalErrors = 0;

  startTrace(requestId: string, method: string, path: string): void {
    this.traces.set(requestId, {
      requestId,
      method,
      path,
      startedAt: Date.now(),
      queries: [],
    });
    this.traceOrder.push(requestId);
    while (this.traceOrder.length > MAX_TRACES) {
      const expired = this.traceOrder.shift();
      if (expired) this.traces.delete(expired);
    }
  }

  finishTrace(requestId: string, statusCode: number | undefined, totalMs: number): void {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    trace.statusCode = statusCode;
    trace.totalMs = Number(totalMs.toFixed(2));
  }

  pushTraceQuery(requestId: string, model: string, action: string, durationMs: number): void {
    const trace = this.traces.get(requestId);
    if (!trace) return;
    if (trace.queries.length >= MAX_QUERIES_PER_TRACE) return;
    trace.queries.push({ model, action, durationMs: Number(durationMs.toFixed(2)), at: Date.now() });
  }

  getTrace(requestId: string): RequestTrace | undefined {
    return this.traces.get(requestId);
  }

  recordHttp(
    method: string,
    path: string,
    durationMs: number,
    statusCode: number | undefined,
    slow: boolean,
    requestId?: string,
  ): void {
    this.totalRequests += 1;
    const isError = (statusCode ?? 0) >= 500;
    if (isError) this.totalErrors += 1;

    const key = `${method} ${path}`;
    let bucket = this.routes.get(key);
    if (!bucket) {
      bucket = {
        key,
        method,
        path,
        count: 0,
        errorCount: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
        samples: [],
      };
      this.routes.set(key, bucket);
    }

    bucket.count += 1;
    bucket.totalMs += durationMs;
    bucket.lastMs = durationMs;
    if (durationMs > bucket.maxMs) bucket.maxMs = durationMs;
    if (isError) bucket.errorCount += 1;
    bucket.samples.push({ duration: durationMs, slow, statusCode, at: Date.now() });
    if (bucket.samples.length > MAX_SAMPLES_PER_ROUTE) {
      bucket.samples.shift();
    }

    this.recent.unshift({
      method,
      path,
      statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      slow,
      at: Date.now(),
      requestId,
    });
    if (this.recent.length > MAX_RECENT_REQUESTS) {
      this.recent.length = MAX_RECENT_REQUESTS;
    }
  }

  recordGameMetric(scope: string, name: string, durationMs: number): void {
    const key = `${scope}.${name}`;
    let bucket = this.gameMetrics.get(key);
    if (!bucket) {
      bucket = { key, scope, name, count: 0, totalMs: 0, maxMs: 0, lastMs: 0, samples: [] };
      this.gameMetrics.set(key, bucket);
    }
    bucket.count += 1;
    bucket.totalMs += durationMs;
    bucket.lastMs = durationMs;
    if (durationMs > bucket.maxMs) bucket.maxMs = durationMs;
    bucket.samples.push(durationMs);
    if (bucket.samples.length > MAX_SAMPLES_PER_ROUTE) bucket.samples.shift();
  }

  recordRedis(command: string, prefix: string, durationMs: number, hit?: boolean): void {
    const key = `${command}:${prefix}`;
    let bucket = this.redisOps.get(key);
    if (!bucket) {
      bucket = {
        key,
        command,
        prefix,
        count: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
        samples: [],
        hits: 0,
        misses: 0,
      };
      this.redisOps.set(key, bucket);
    }
    bucket.count += 1;
    bucket.totalMs += durationMs;
    bucket.lastMs = durationMs;
    if (durationMs > bucket.maxMs) bucket.maxMs = durationMs;
    bucket.samples.push(durationMs);
    if (bucket.samples.length > MAX_SAMPLES_PER_ROUTE) bucket.samples.shift();
    if (hit === true) bucket.hits = (bucket.hits ?? 0) + 1;
    else if (hit === false) bucket.misses = (bucket.misses ?? 0) + 1;
  }

  recordRawQuery(sql: string, params: unknown[], durationMs: number): void {
    const id = hashSql(sql);
    let bucket = this.rawQueries.get(id);
    if (!bucket) {
      bucket = {
        id,
        sql,
        lastParams: params,
        count: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
        lastAt: Date.now(),
        samples: [],
      };
      this.rawQueries.set(id, bucket);
    }
    bucket.count += 1;
    bucket.totalMs += durationMs;
    bucket.lastMs = durationMs;
    bucket.lastAt = Date.now();
    bucket.lastParams = params;
    if (durationMs > bucket.maxMs) bucket.maxMs = durationMs;
    bucket.samples.push(durationMs);
    if (bucket.samples.length > MAX_SAMPLES_PER_ROUTE) bucket.samples.shift();
  }

  getRawQuery(id: string): RawQueryBucket | undefined {
    return this.rawQueries.get(id);
  }

  getRawQueriesSnapshot(limit = 20): RawQueryStat[] {
    const stats: RawQueryStat[] = [];
    for (const bucket of this.rawQueries.values()) {
      const sorted = [...bucket.samples].sort((a, b) => a - b);
      stats.push({
        id: bucket.id,
        sql: bucket.sql,
        lastParams: bucket.lastParams,
        count: bucket.count,
        avgMs: round(bucket.totalMs / bucket.count),
        maxMs: round(bucket.maxMs),
        lastMs: round(bucket.lastMs),
        p95: round(percentile(sorted, 95)),
        lastAt: bucket.lastAt,
      });
    }
    stats.sort((a, b) => b.p95 - a.p95);
    return stats.slice(0, limit);
  }

  recordPrisma(model: string, action: string, durationMs: number): void {
    const key = `${model}.${action}`;
    let bucket = this.prisma.get(key);
    if (!bucket) {
      bucket = { key, model, action, count: 0, totalMs: 0, maxMs: 0, lastMs: 0, samples: [] };
      this.prisma.set(key, bucket);
    }
    bucket.count += 1;
    bucket.totalMs += durationMs;
    bucket.lastMs = durationMs;
    if (durationMs > bucket.maxMs) bucket.maxMs = durationMs;
    bucket.samples.push(durationMs);
    if (bucket.samples.length > MAX_SAMPLES_PER_ROUTE) {
      bucket.samples.shift();
    }
  }

  getRoutesSnapshot(limit = 20): RouteStat[] {
    const stats: RouteStat[] = [];
    for (const bucket of this.routes.values()) {
      const sorted = bucket.samples.map((s) => s.duration).sort((a, b) => a - b);
      stats.push({
        key: bucket.key,
        method: bucket.method,
        path: bucket.path,
        count: bucket.count,
        errorCount: bucket.errorCount,
        avgMs: round(bucket.totalMs / bucket.count),
        maxMs: round(bucket.maxMs),
        lastMs: round(bucket.lastMs),
        p50: round(percentile(sorted, 50)),
        p95: round(percentile(sorted, 95)),
        p99: round(percentile(sorted, 99)),
      });
    }
    stats.sort((a, b) => b.p95 - a.p95);
    return stats.slice(0, limit);
  }

  getGameMetricsSnapshot(limit = 30): GameMetricStat[] {
    const stats: GameMetricStat[] = [];
    for (const bucket of this.gameMetrics.values()) {
      const sorted = [...bucket.samples].sort((a, b) => a - b);
      stats.push({
        key: bucket.key,
        scope: bucket.scope,
        name: bucket.name,
        count: bucket.count,
        avgMs: round(bucket.totalMs / bucket.count),
        maxMs: round(bucket.maxMs),
        lastMs: round(bucket.lastMs),
        p95: round(percentile(sorted, 95)),
      });
    }
    stats.sort((a, b) => b.p95 - a.p95);
    return stats.slice(0, limit);
  }

  getRedisSnapshot(limit = 30): RedisStat[] {
    const stats: RedisStat[] = [];
    for (const bucket of this.redisOps.values()) {
      const sorted = [...bucket.samples].sort((a, b) => a - b);
      const hits = bucket.hits ?? 0;
      const misses = bucket.misses ?? 0;
      const total = hits + misses;
      stats.push({
        key: bucket.key,
        command: bucket.command,
        prefix: bucket.prefix,
        count: bucket.count,
        avgMs: round(bucket.totalMs / bucket.count),
        maxMs: round(bucket.maxMs),
        lastMs: round(bucket.lastMs),
        p95: round(percentile(sorted, 95)),
        hits,
        misses,
        hitRate: total > 0 ? Number((hits / total).toFixed(3)) : null,
      });
    }
    stats.sort((a, b) => b.p95 - a.p95);
    return stats.slice(0, limit);
  }

  getPrismaSnapshot(limit = 15): PrismaStat[] {
    const stats: PrismaStat[] = [];
    for (const bucket of this.prisma.values()) {
      const sorted = [...bucket.samples].sort((a, b) => a - b);
      stats.push({
        key: bucket.key,
        model: bucket.model,
        action: bucket.action,
        count: bucket.count,
        avgMs: round(bucket.totalMs / bucket.count),
        maxMs: round(bucket.maxMs),
        lastMs: round(bucket.lastMs),
        p95: round(percentile(sorted, 95)),
      });
    }
    stats.sort((a, b) => b.p95 - a.p95);
    return stats.slice(0, limit);
  }

  getRecentRequests(): RecentRequest[] {
    return [...this.recent];
  }

  getTotals(): { totalRequests: number; totalErrors: number; uptimeMs: number } {
    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      uptimeMs: Math.round(performance.now() - this.startedAt),
    };
  }

  reset(): void {
    this.routes.clear();
    this.prisma.clear();
    this.rawQueries.clear();
    this.gameMetrics.clear();
    this.redisOps.clear();
    this.recent.length = 0;
    this.traces.clear();
    this.traceOrder.length = 0;
    this.totalRequests = 0;
    this.totalErrors = 0;
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function round(n: number): number {
  return Number(n.toFixed(2));
}

function hashSql(sql: string): string {
  let hash = 0;
  for (let i = 0; i < sql.length; i += 1) {
    hash = (hash * 31 + sql.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

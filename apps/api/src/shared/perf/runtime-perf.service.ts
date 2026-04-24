import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import {
  PerformanceObserver,
  constants as perfConstants,
  monitorEventLoopDelay,
} from 'node:perf_hooks';
import v8 from 'node:v8';
import { PerfLoggerService } from './perf-logger.service';

interface GcStats {
  count: number;
  totalPauseMs: number;
  maxPauseMs: number;
  lastPauseMs: number;
  byKind: Record<string, { count: number; totalPauseMs: number }>;
}

@Injectable()
export class RuntimePerfService implements OnModuleInit, OnApplicationShutdown {
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  private snapshotInterval: NodeJS.Timeout | null = null;
  private heapSampleInterval: NodeJS.Timeout | null = null;
  private gcObserver: PerformanceObserver | null = null;
  private activeSseStreams = 0;
  private activeSseSubscribers = 0;
  private totalSseEvents = 0;
  private gcStats: GcStats = {
    count: 0,
    totalPauseMs: 0,
    maxPauseMs: 0,
    lastPauseMs: 0,
    byKind: {},
  };
  private heapHistory: Array<{ at: number; usedMb: number }> = [];

  constructor(private readonly perfLogger: PerfLoggerService) {}

  onModuleInit(): void {
    this.eventLoopDelay.enable();

    const intervalMs = this.getEventLoopSampleIntervalMs();
    this.snapshotInterval = setInterval(() => {
      this.flushEventLoopLag();
    }, intervalMs);
    this.snapshotInterval.unref();

    try {
      this.gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const kind = gcKindName((entry as PerformanceEntry & { detail?: { kind?: number } }).detail?.kind);
          this.gcStats.count += 1;
          this.gcStats.totalPauseMs += entry.duration;
          this.gcStats.lastPauseMs = entry.duration;
          if (entry.duration > this.gcStats.maxPauseMs) {
            this.gcStats.maxPauseMs = entry.duration;
          }
          const prev = this.gcStats.byKind[kind] ?? { count: 0, totalPauseMs: 0 };
          this.gcStats.byKind[kind] = {
            count: prev.count + 1,
            totalPauseMs: prev.totalPauseMs + entry.duration,
          };
        }
      });
      this.gcObserver.observe({ entryTypes: ['gc'], buffered: false });
    } catch {
      this.gcObserver = null;
    }

    this.heapSampleInterval = setInterval(() => {
      const used = process.memoryUsage().heapUsed;
      this.heapHistory.push({ at: Date.now(), usedMb: Number((used / (1024 * 1024)).toFixed(1)) });
      if (this.heapHistory.length > 120) this.heapHistory.shift();
    }, 2000);
    this.heapSampleInterval.unref();
  }

  onApplicationShutdown(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
    if (this.heapSampleInterval) {
      clearInterval(this.heapSampleInterval);
      this.heapSampleInterval = null;
    }
    this.gcObserver?.disconnect();
    this.gcObserver = null;

    this.flushEventLoopLag(true);
    this.eventLoopDelay.disable();
  }

  getStartupSnapshot(): Record<string, number> {
    return {
      active_sse_streams: this.activeSseStreams,
      active_sse_subscribers: this.activeSseSubscribers,
      event_loop_lag_p95_ms: this.readEventLoopLagP95Ms(),
    };
  }

  getLiveSnapshot(): {
    eventLoopLagP95Ms: number;
    eventLoopLagMeanMs: number;
    activeSseStreams: number;
    activeSseSubscribers: number;
    totalSseEvents: number;
    gc: GcStats;
    heapLimitMb: number;
    heapHistory: Array<{ at: number; usedMb: number }>;
  } {
    const meanNs = Number.isFinite(this.eventLoopDelay.mean) ? this.eventLoopDelay.mean : 0;
    const heapStats = v8.getHeapStatistics();
    return {
      eventLoopLagP95Ms: this.readEventLoopLagP95Ms(),
      eventLoopLagMeanMs: meanNs > 0 ? Number((meanNs / 1_000_000).toFixed(2)) : 0,
      activeSseStreams: this.activeSseStreams,
      activeSseSubscribers: this.activeSseSubscribers,
      totalSseEvents: this.totalSseEvents,
      gc: {
        count: this.gcStats.count,
        totalPauseMs: Number(this.gcStats.totalPauseMs.toFixed(2)),
        maxPauseMs: Number(this.gcStats.maxPauseMs.toFixed(2)),
        lastPauseMs: Number(this.gcStats.lastPauseMs.toFixed(2)),
        byKind: Object.fromEntries(
          Object.entries(this.gcStats.byKind).map(([k, v]) => [
            k,
            { count: v.count, totalPauseMs: Number(v.totalPauseMs.toFixed(2)) },
          ]),
        ),
      },
      heapLimitMb: Number((heapStats.heap_size_limit / (1024 * 1024)).toFixed(0)),
      heapHistory: [...this.heapHistory],
    };
  }

  updateSseCounts(activeStreams: number, activeSubscribers: number): void {
    if (
      this.activeSseStreams === activeStreams &&
      this.activeSseSubscribers === activeSubscribers
    ) {
      return;
    }

    this.activeSseStreams = activeStreams;
    this.activeSseSubscribers = activeSubscribers;

    this.perfLogger.logMetric(
      'sse',
      'streams.active',
      activeStreams,
      {
        active_sse_subscribers: activeSubscribers,
      },
      { decimals: 0, force: true },
    );
    this.perfLogger.logMetric(
      'sse',
      'subscribers.active',
      activeSubscribers,
      {
        active_sse_streams: activeStreams,
      },
      { decimals: 0, force: true },
    );
  }

  recordSseEvent(sessionId: string, eventType: string, activeSubscribers: number): void {
    this.totalSseEvents += 1;
    this.perfLogger.logMetric(
      'sse',
      'event.fanout',
      activeSubscribers,
      {
        event_type: eventType,
        session_id: sessionId,
        active_sse_streams: this.activeSseStreams,
      },
      { decimals: 0, force: true },
    );
  }

  getTotalSseEvents(): number {
    return this.totalSseEvents;
  }

  private flushEventLoopLag(force = false): void {
    const lagMs = this.readEventLoopLagP95Ms();
    if (lagMs > 0) {
      this.perfLogger.logMetric('runtime', 'event_loop.lag', lagMs, {}, { force });
    }

    this.eventLoopDelay.reset();
  }

  private readEventLoopLagP95Ms(): number {
    const percentile = this.eventLoopDelay.percentile(95);
    if (!Number.isFinite(percentile) || percentile <= 0) {
      return 0;
    }

    return Number((percentile / 1_000_000).toFixed(2));
  }

  private getEventLoopSampleIntervalMs(): number {
    const parsed = Number.parseInt(process.env.PERF_EVENT_LOOP_SAMPLE_MS ?? '1000', 10);

    if (!Number.isFinite(parsed) || parsed < 100) {
      return 1000;
    }

    return parsed;
  }
}

function gcKindName(kind: number | undefined): string {
  switch (kind) {
    case perfConstants.NODE_PERFORMANCE_GC_MAJOR:
      return 'major';
    case perfConstants.NODE_PERFORMANCE_GC_MINOR:
      return 'minor';
    case perfConstants.NODE_PERFORMANCE_GC_INCREMENTAL:
      return 'incremental';
    case perfConstants.NODE_PERFORMANCE_GC_WEAKCB:
      return 'weakcb';
    default:
      return 'unknown';
  }
}

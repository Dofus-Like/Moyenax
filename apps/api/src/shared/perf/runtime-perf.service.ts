import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { PerfLoggerService } from './perf-logger.service';

@Injectable()
export class RuntimePerfService implements OnModuleInit, OnApplicationShutdown {
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  private snapshotInterval: NodeJS.Timeout | null = null;
  private activeSseStreams = 0;
  private activeSseSubscribers = 0;
  private totalSseEvents = 0;

  constructor(private readonly perfLogger: PerfLoggerService) {}

  onModuleInit(): void {
    this.eventLoopDelay.enable();

    const intervalMs = this.getEventLoopSampleIntervalMs();
    this.snapshotInterval = setInterval(() => {
      this.flushEventLoopLag();
    }, intervalMs);
    this.snapshotInterval.unref();
  }

  onApplicationShutdown(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }

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

  recordSseEvent(
    sessionId: string,
    eventType: string,
    activeSubscribers: number,
  ): void {
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
      this.perfLogger.logMetric(
        'runtime',
        'event_loop.lag',
        lagMs,
        {},
        { force },
      );
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
    const parsed = Number.parseInt(
      process.env.PERF_EVENT_LOOP_SAMPLE_MS ?? '1000',
      10,
    );

    if (!Number.isFinite(parsed) || parsed < 100) {
      return 1000;
    }

    return parsed;
  }
}

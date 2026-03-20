import { Injectable } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

type PerfLevel = 'info' | 'warn' | 'error';

interface PerfLogOptions {
  force?: boolean;
  level?: PerfLevel;
  slowThresholdMs?: number;
}

@Injectable()
export class PerfLoggerService {
  constructor(private readonly requestContext: RequestContextService) {}

  isEnabled(): boolean {
    const flag = (process.env.PERF_LOGS ?? '').toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'yes';
  }

  logEvent(
    scope: string,
    name: string,
    metadata: Record<string, unknown> = {},
    options: PerfLogOptions = {},
  ): void {
    if (!this.shouldLog(options.force ?? false, false)) {
      return;
    }

    this.writeRecord(scope, name, undefined, false, metadata, options.level ?? 'info');
  }

  logDuration(
    scope: string,
    name: string,
    durationMs: number,
    metadata: Record<string, unknown> = {},
    options: PerfLogOptions = {},
  ): void {
    const roundedDuration = Number(durationMs.toFixed(2));
    const threshold = options.slowThresholdMs ?? this.getSlowThresholdMs();
    const slow = roundedDuration >= threshold;

    if (!this.shouldLog(options.force ?? false, slow)) {
      return;
    }

    this.writeRecord(
      scope,
      name,
      roundedDuration,
      slow,
      metadata,
      options.level ?? (slow ? 'warn' : 'info'),
    );
  }

  private shouldLog(force: boolean, slow: boolean): boolean {
    if (force) {
      return true;
    }

    if (!this.isEnabled()) {
      return false;
    }

    if (slow) {
      return true;
    }

    return Math.random() <= this.getSampleRate();
  }

  private getSlowThresholdMs(): number {
    const parsed = Number.parseFloat(process.env.PERF_LOG_SLOW_MS ?? '100');
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 100;
  }

  private getSampleRate(): number {
    const parsed = Number.parseFloat(process.env.PERF_LOG_SAMPLE_RATE ?? '1');
    if (!Number.isFinite(parsed)) {
      return 1;
    }

    return Math.max(0, Math.min(1, parsed));
  }

  private writeRecord(
    scope: string,
    name: string,
    durationMs: number | undefined,
    slow: boolean,
    metadata: Record<string, unknown>,
    level: PerfLevel,
  ): void {
    const context = this.requestContext.get();
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      scope,
      name,
      pid: process.pid,
      request_id: context?.requestId,
      method: context?.method,
      path: context?.path,
      user_id: context?.userId,
      ...metadata,
    };

    if (durationMs !== undefined) {
      record.duration_ms = durationMs;
      record.slow = slow;
    }

    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
}

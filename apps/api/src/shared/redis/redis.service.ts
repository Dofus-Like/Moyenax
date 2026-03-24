import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { performance } from 'node:perf_hooks';
import Redis from 'ioredis';
import { PerfLoggerService } from '../perf/perf-logger.service';

@Injectable()
export class RedisService {
  private readonly client: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly perfLogger: PerfLoggerService,
  ) {
    this.client = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'));
  }

  async get(key: string): Promise<string | null> {
    return this.measure('get', key, () => this.client.get(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.measure('set', key, async () => {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
        return;
      }

      await this.client.set(key, value);
    });
  }

  async del(key: string): Promise<void> {
    await this.measure('del', key, () => this.client.del(key).then(() => undefined));
  }

  async setIfNotExists(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    return this.measure('setnx', key, async () => {
      const response = ttlSeconds
        ? await this.client.set(key, value, 'EX', ttlSeconds, 'NX')
        : await this.client.set(key, value, 'NX');
      return response === 'OK';
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);

    if (this.getKeyPrefix(key) === 'combat') {
      this.perfLogger.logMetric(
        'combat_state',
        'payload.bytes',
        Buffer.byteLength(payload, 'utf8'),
        {
          key_prefix: 'combat',
          session_id: this.getKeySuffix(key),
        },
        { decimals: 0, force: true },
      );
    }

    await this.set(key, payload, ttlSeconds);
  }

  async zAdd(key: string, score: number, member: string): Promise<void> {
    await this.measure('zadd', key, () => this.client.zadd(key, score, member).then(() => undefined));
  }

  async zRange(key: string, start: number, stop: number): Promise<string[]> {
    return this.measure('zrange', key, () => this.client.zrange(key, start, stop));
  }

  async zRem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) {
      return 0;
    }

    return this.measure('zrem', key, () => this.client.zrem(key, ...members));
  }

  async zScore(key: string, member: string): Promise<number | null> {
    return this.measure('zscore', key, async () => {
      const score = await this.client.zscore(key, member);
      return score == null ? null : Number(score);
    });
  }

  async zCard(key: string): Promise<number> {
    return this.measure('zcard', key, () => this.client.zcard(key));
  }

  private async measure<T>(operation: string, key: string, callback: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await callback();
    } finally {
      this.perfLogger.logDuration('redis', `${operation}:${this.getKeyPrefix(key)}`, performance.now() - startedAt, {
        redis_op: operation,
        key_prefix: this.getKeyPrefix(key),
      });
    }
  }

  private getKeyPrefix(key: string): string {
    const [prefix] = key.split(':');
    return prefix || 'unknown';
  }

  private getKeySuffix(key: string): string | undefined {
    const [, suffix] = key.split(':');
    return suffix;
  }
}

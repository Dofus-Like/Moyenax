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

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
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
}

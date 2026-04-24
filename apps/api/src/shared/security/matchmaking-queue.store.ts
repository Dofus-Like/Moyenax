import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { MATCHMAKING_QUEUE_KEY } from './security.constants';

const REDIS_TYPE_NONE = 'none';
const REDIS_TYPE_STRING = 'string';
const REDIS_TYPE_ZSET = 'zset';

@Injectable()
export class MatchmakingQueueStore implements OnModuleInit {
  private readonly logger = new Logger(MatchmakingQueueStore.name);
  private normalizationPromise: Promise<void> | null = null;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureQueueCompatible();
  }

  async isQueued(playerId: string): Promise<boolean> {
    return (await this.getScore(playerId)) !== null;
  }

  async getScore(playerId: string): Promise<number | null> {
    await this.ensureQueueCompatible();
    return this.redis.zScore(MATCHMAKING_QUEUE_KEY, playerId);
  }

  async add(playerId: string, score: number): Promise<void> {
    await this.ensureQueueCompatible();
    await this.redis.zAdd(MATCHMAKING_QUEUE_KEY, score, playerId);
  }

  async remove(...playerIds: string[]): Promise<number> {
    await this.ensureQueueCompatible();
    return this.redis.zRem(MATCHMAKING_QUEUE_KEY, ...playerIds);
  }

  async size(): Promise<number> {
    await this.ensureQueueCompatible();
    return this.redis.zCard(MATCHMAKING_QUEUE_KEY);
  }

  async range(start: number, stop: number): Promise<string[]> {
    await this.ensureQueueCompatible();
    return this.redis.zRange(MATCHMAKING_QUEUE_KEY, start, stop);
  }

  async ensureQueueCompatible(): Promise<void> {
    if (this.normalizationPromise) {
      await this.normalizationPromise;
      return;
    }

    this.normalizationPromise = this.normalizeQueue().finally(() => {
      this.normalizationPromise = null;
    });

    await this.normalizationPromise;
  }

  private async normalizeQueue(): Promise<void> {
    const keyType = await this.redis.type(MATCHMAKING_QUEUE_KEY);

    if (keyType === REDIS_TYPE_NONE || keyType === REDIS_TYPE_ZSET) {
      return;
    }

    if (keyType === REDIS_TYPE_STRING) {
      await this.migrateLegacyStringQueue();
      return;
    }

    await this.backupUnsupportedQueue(keyType);
  }

  private async migrateLegacyStringQueue(): Promise<void> {
    const backupKey = this.buildBackupKey();
    await this.redis.rename(MATCHMAKING_QUEUE_KEY, backupKey);

    const rawQueue = await this.redis.get(backupKey);
    if (!rawQueue) {
      await this.redis.del(backupKey);
      return;
    }

    const parsedQueue = this.parseLegacyQueue(rawQueue);
    if (!parsedQueue) {
      this.logger.warn(
        `Legacy matchmaking queue payload is invalid JSON; kept backup in "${backupKey}" and recreated an empty queue.`,
      );
      return;
    }

    await this.redis.zAddMany(
      MATCHMAKING_QUEUE_KEY,
      parsedQueue.map((playerId, index) => ({
        score: index + 1,
        member: playerId,
      })),
    );
    await this.redis.del(backupKey);

    this.logger.warn(
      `Migrated legacy matchmaking queue from string payload to zset with ${parsedQueue.length} entr${parsedQueue.length > 1 ? 'ies' : 'y'}.`,
    );
  }

  private async backupUnsupportedQueue(keyType: string): Promise<void> {
    const backupKey = this.buildBackupKey();
    await this.redis.rename(MATCHMAKING_QUEUE_KEY, backupKey);
    this.logger.warn(
      `Unsupported Redis type "${keyType}" found for matchmaking queue. Backed it up to "${backupKey}" and reset the queue.`,
    );
  }

  private parseLegacyQueue(rawQueue: string): string[] | null {
    try {
      const parsed = JSON.parse(rawQueue);
      if (
        !Array.isArray(parsed) ||
        !parsed.every((entry) => typeof entry === 'string' && entry.length > 0)
      ) {
        return null;
      }

      return [...new Set(parsed)];
    } catch {
      return null;
    }
  }

  private buildBackupKey(): string {
    return `${MATCHMAKING_QUEUE_KEY}:legacy:${new Date().toISOString().replace(/[:.]/g, '-')}`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

/**
 * Lock distribué basé sur Redis SETNX + fingerprint UUID.
 *
 * Remplace les `new Set<string>()` en mémoire du TurnService / GameSessionService
 * qui ne fonctionnaient que sur une seule instance NestJS (cf. TESTS_REPORT.md bugs #7, #9).
 *
 * Pattern:
 *   1. `acquire(key, ttl)` tente un SETNX avec une fingerprint UUID unique
 *   2. Le travail est exécuté pendant que le lock est tenu
 *   3. `release(key, fingerprint)` ne libère QUE si la fingerprint matche
 *      (évite qu'un process libère le lock d'un autre si le TTL a expiré entre-temps)
 *
 * Le caller est responsable de choisir un TTL adapté :
 *   - petit TTL si le travail est rapide (limite les blocages si crash)
 *   - gros TTL si le travail est long (évite l'expiration pendant le travail)
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Tente d'acquérir un lock. Retourne la fingerprint si acquis, null sinon.
   */
  async acquire(key: string, ttlSeconds: number): Promise<string | null> {
    const fingerprint = randomUUID();
    const acquired = await this.redis.setIfNotExists(key, fingerprint, ttlSeconds);
    return acquired ? fingerprint : null;
  }

  /**
   * Libère le lock uniquement si la fingerprint matche.
   * Si un autre process a pris le lock entre-temps (TTL expiré), ne fait rien.
   */
  async release(key: string, fingerprint: string): Promise<boolean> {
    const currentFingerprint = await this.redis.get(key);
    if (currentFingerprint !== fingerprint) {
      // Lock déjà expiré ou pris par un autre process — on ne libère pas
      this.logger.warn(
        `Lock ${key} fingerprint mismatch on release (expected=${fingerprint}, actual=${currentFingerprint ?? 'null'}). Skipping release.`,
      );
      return false;
    }
    await this.redis.del(key);
    return true;
  }

  /**
   * Exécute `fn` sous un lock distribué. Relâche automatiquement en cas d'erreur ou de succès.
   * Throw un `LockNotAcquiredError` si le lock n'a pas pu être pris.
   *
   * @example
   *   await lock.withLock(`combat:${sessionId}`, 10, async () => { ... })
   */
  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const fingerprint = await this.acquire(key, ttlSeconds);
    if (!fingerprint) {
      throw new LockNotAcquiredError(key);
    }
    try {
      return await fn();
    } finally {
      await this.release(key, fingerprint).catch((err) => {
        this.logger.error(`Failed to release lock ${key}: ${err}`);
      });
    }
  }

  /**
   * Variante non-bloquante : retourne null si lock pas pris, sans throw.
   */
  async tryWithLock<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const fingerprint = await this.acquire(key, ttlSeconds);
    if (!fingerprint) return null;
    try {
      return await fn();
    } finally {
      await this.release(key, fingerprint).catch((err) => {
        this.logger.error(`Failed to release lock ${key}: ${err}`);
      });
    }
  }
}

export class LockNotAcquiredError extends Error {
  constructor(public readonly key: string) {
    super(`Could not acquire distributed lock: ${key}`);
    this.name = 'LockNotAcquiredError';
  }
}

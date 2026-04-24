import { Test, TestingModule } from '@nestjs/testing';
import {
  DistributedLockService,
  LockNotAcquiredError,
} from './distributed-lock.service';
import { RedisService } from '../redis/redis.service';
import { makeRedisMock } from '../../test/mocks/redis.mock';

describe('DistributedLockService', () => {
  let service: DistributedLockService;
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(async () => {
    redis = makeRedisMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributedLockService,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(DistributedLockService);
  });

  describe('acquire', () => {
    it('retourne une fingerprint UUID quand le lock est acquis', async () => {
      const fp = await service.acquire('my-key', 10);
      expect(fp).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('retourne null si la clé existe déjà', async () => {
      await service.acquire('my-key', 10);
      const second = await service.acquire('my-key', 10);
      expect(second).toBeNull();
    });

    it('stocke la fingerprint en Redis', async () => {
      const fp = await service.acquire('my-key', 10);
      expect(redis._store.get('my-key')).toBe(fp);
    });

    it('TTL est passé au SETNX', async () => {
      await service.acquire('my-key', 42);
      expect(redis.setIfNotExists).toHaveBeenCalledWith('my-key', expect.any(String), 42);
    });
  });

  describe('release', () => {
    it('libère le lock si fingerprint matche', async () => {
      const fp = await service.acquire('k', 10);
      const ok = await service.release('k', fp!);
      expect(ok).toBe(true);
      expect(redis._store.has('k')).toBe(false);
    });

    it('ne libère PAS si fingerprint différente (évite release cross-process)', async () => {
      await service.acquire('k', 10);
      const ok = await service.release('k', 'wrong-fingerprint');
      expect(ok).toBe(false);
      expect(redis._store.has('k')).toBe(true);
    });

    it('ne fait rien si la clé n\'existe pas (déjà expirée)', async () => {
      const ok = await service.release('nonexistent', 'any-fp');
      expect(ok).toBe(false);
    });
  });

  describe('withLock', () => {
    it('exécute fn et libère le lock en fin', async () => {
      const result = await service.withLock('k', 5, async () => 42);
      expect(result).toBe(42);
      expect(redis._store.has('k')).toBe(false);
    });

    it('libère même si fn throw', async () => {
      await expect(
        service.withLock('k', 5, async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(redis._store.has('k')).toBe(false);
    });

    it('throw LockNotAcquiredError si lock déjà pris', async () => {
      await service.acquire('k', 60);
      await expect(
        service.withLock('k', 5, async () => 'never runs'),
      ).rejects.toThrow(LockNotAcquiredError);
    });

    it('un second withLock après le premier peut réacquérir', async () => {
      await service.withLock('k', 5, async () => 'first');
      const r = await service.withLock('k', 5, async () => 'second');
      expect(r).toBe('second');
    });
  });

  describe('tryWithLock', () => {
    it('retourne null si lock déjà pris, pas de throw', async () => {
      await service.acquire('k', 60);
      const r = await service.tryWithLock('k', 5, async () => 'x');
      expect(r).toBeNull();
    });

    it('exécute et retourne le résultat si lock acquis', async () => {
      const r = await service.tryWithLock('k', 5, async () => 'ok');
      expect(r).toBe('ok');
    });
  });

  describe('[CONCURRENCE] simulation deux process', () => {
    it('deux acquires concurrents, un seul gagne', async () => {
      const [a, b] = await Promise.all([
        service.acquire('concurrent-key', 10),
        service.acquire('concurrent-key', 10),
      ]);
      const winners = [a, b].filter((x) => x !== null);
      expect(winners).toHaveLength(1);
    });

    it('deux withLock en parallèle: un succès, un throw', async () => {
      const results = await Promise.allSettled([
        service.withLock('concurrent-key', 10, async () => 'A'),
        service.withLock('concurrent-key', 10, async () => 'B'),
      ]);
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(LockNotAcquiredError);
    });
  });
});

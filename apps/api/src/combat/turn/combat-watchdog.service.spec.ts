import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CombatWatchdogService } from './combat-watchdog.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { DistributedLockService } from '../../shared/security/distributed-lock.service';

describe('CombatWatchdogService', () => {
  let service: CombatWatchdogService;
  let redis: { keys: jest.Mock; getJson: jest.Mock };
  let sse: { emit: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let lock: { tryWithLock: jest.Mock };

  beforeEach(async () => {
    redis = { keys: jest.fn().mockResolvedValue([]), getJson: jest.fn() };
    sse = { emit: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    lock = { tryWithLock: jest.fn(async (_k, _ttl, fn) => fn()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CombatWatchdogService,
        { provide: RedisService, useValue: redis },
        { provide: SseService, useValue: sse },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: DistributedLockService, useValue: lock },
      ],
    }).compile();

    service = module.get(CombatWatchdogService);
  });

  describe('enable/disable', () => {
    it('scanStuckCombats ne fait rien si disabled', async () => {
      service.disable();
      await service.scanStuckCombats();
      expect(lock.tryWithLock).not.toHaveBeenCalled();
    });

    it('enable réactive', async () => {
      service.disable();
      service.enable();
      await service.scanStuckCombats();
      expect(lock.tryWithLock).toHaveBeenCalled();
    });
  });

  describe('doScan', () => {
    it('retourne 0/0 si aucune clé combat', async () => {
      redis.keys.mockResolvedValue([]);
      const result = await service.doScan();
      expect(result).toEqual({ scanned: 0, timedOut: 0 });
    });

    it('ignore les clés de lock (combat:lock:*)', async () => {
      redis.keys.mockResolvedValue(['combat:lock:s1', 'combat:watchdog:lock']);
      const result = await service.doScan();
      expect(result.scanned).toBe(0);
    });

    it('ignore les combats terminés (winnerId présent)', async () => {
      redis.keys.mockResolvedValue(['combat:s1']);
      redis.getJson.mockResolvedValue({
        sessionId: 's1',
        winnerId: 'p1',
        lastActionAt: Date.now() - 999_999,
        currentTurnPlayerId: 'p2',
        turnNumber: 5,
      });
      const result = await service.doScan();
      expect(result.timedOut).toBe(0);
      expect(sse.emit).not.toHaveBeenCalled();
    });

    it('ignore les combats sans lastActionAt (jamais tracké)', async () => {
      redis.keys.mockResolvedValue(['combat:s1']);
      redis.getJson.mockResolvedValue({
        sessionId: 's1',
        currentTurnPlayerId: 'p1',
        turnNumber: 1,
      });
      const result = await service.doScan();
      expect(result.timedOut).toBe(0);
    });

    it('ignore les combats récents (< 90s)', async () => {
      redis.keys.mockResolvedValue(['combat:s1']);
      redis.getJson.mockResolvedValue({
        sessionId: 's1',
        lastActionAt: Date.now() - 30_000,
        currentTurnPlayerId: 'p1',
        turnNumber: 5,
      });
      const result = await service.doScan();
      expect(result.timedOut).toBe(0);
    });

    it('déclenche SSE TURN_TIMED_OUT pour combat stuck (> 90s)', async () => {
      redis.keys.mockResolvedValue(['combat:s1']);
      redis.getJson.mockResolvedValue({
        sessionId: 's1',
        lastActionAt: Date.now() - 120_000, // 2 min
        currentTurnPlayerId: 'stuck-player',
        turnNumber: 10,
      });
      const result = await service.doScan();
      expect(result.timedOut).toBe(1);
      expect(sse.emit).toHaveBeenCalledWith(
        's1',
        'TURN_TIMED_OUT',
        expect.objectContaining({ playerId: 'stuck-player', turnNumber: 10 }),
      );
    });

    it('traite plusieurs combats en parallèle', async () => {
      redis.keys.mockResolvedValue(['combat:s1', 'combat:s2', 'combat:s3']);
      redis.getJson.mockImplementation(async (k: string) => {
        if (k === 'combat:s1')
          return { sessionId: 's1', lastActionAt: Date.now() - 100_000, currentTurnPlayerId: 'p1', turnNumber: 1 };
        if (k === 'combat:s2')
          return { sessionId: 's2', lastActionAt: Date.now() - 30_000, currentTurnPlayerId: 'p1', turnNumber: 1 };
        if (k === 'combat:s3')
          return { sessionId: 's3', lastActionAt: Date.now() - 200_000, currentTurnPlayerId: 'p1', turnNumber: 1 };
        return null;
      });
      const result = await service.doScan();
      expect(result.scanned).toBe(3);
      expect(result.timedOut).toBe(2); // s1 et s3
    });

    it('continue sur erreur de getJson pour une clé', async () => {
      redis.keys.mockResolvedValue(['combat:bad', 'combat:good']);
      redis.getJson.mockImplementation(async (k: string) => {
        if (k === 'combat:bad') throw new Error('parse error');
        return { sessionId: 'good', lastActionAt: Date.now() - 100_000, currentTurnPlayerId: 'p', turnNumber: 1 };
      });
      const result = await service.doScan();
      expect(result.scanned).toBe(2);
      expect(result.timedOut).toBe(1);
    });
  });

  describe('scanStuckCombats (cron entry point)', () => {
    it('skip si le lock distribué n\'est pas acquis (une autre instance scanne)', async () => {
      lock.tryWithLock.mockResolvedValue(null);
      await service.scanStuckCombats();
      expect(redis.keys).not.toHaveBeenCalled();
    });

    it('exécute le scan si le lock est acquis', async () => {
      redis.keys.mockResolvedValue([]);
      await service.scanStuckCombats();
      expect(redis.keys).toHaveBeenCalledWith('combat:*');
    });
  });
});

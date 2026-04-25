import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingService } from './matchmaking.service';
import { GameSessionService } from './game-session.service';
import { RedisService } from '../shared/redis/redis.service';
import { MatchmakingQueueStore } from '../shared/security/matchmaking-queue.store';
import { SessionSecurityService } from '../shared/security/session-security.service';
import { DistributedLockService } from '../shared/security/distributed-lock.service';
import { PerfStatsService } from '../shared/perf/perf-stats.service';
import { ConflictException } from '@nestjs/common';

describe('MatchmakingService', () => {
  let service: MatchmakingService;
  let redis: { setIfNotExists: jest.Mock; del: jest.Mock };
  let queue: {
    getScore: jest.Mock;
    add: jest.Mock;
    size: jest.Mock;
    range: jest.Mock;
    remove: jest.Mock;
  };
  let gameSession: { createSession: jest.Mock };
  let sessionSecurity: {
    assertPlayerAvailableForPublicRoom: jest.Mock;
    isPlayerQueued: jest.Mock;
  };
  let lock: {
    tryWithLock: jest.Mock;
    withLock: jest.Mock;
    acquire: jest.Mock;
    release: jest.Mock;
  };

  beforeEach(async () => {
    redis = {
      setIfNotExists: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(undefined),
    };
    queue = {
      getScore: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue(undefined),
      size: jest.fn().mockResolvedValue(0),
      range: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(0),
    };
    gameSession = {
      createSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    };
    sessionSecurity = {
      assertPlayerAvailableForPublicRoom: jest.fn().mockResolvedValue(undefined),
      isPlayerQueued: jest.fn().mockResolvedValue(false),
    };
    // Par défaut, le lock est acquis et on exécute la fn
    lock = {
      tryWithLock: jest.fn(async (_k, _ttl, fn) => fn()),
      withLock: jest.fn(async (_k, _ttl, fn) => fn()),
      acquire: jest.fn().mockResolvedValue('fp'),
      release: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: RedisService, useValue: redis },
        { provide: MatchmakingQueueStore, useValue: queue },
        { provide: GameSessionService, useValue: gameSession },
        { provide: SessionSecurityService, useValue: sessionSecurity },
        { provide: PerfStatsService, useValue: { recordGameMetric: jest.fn() } },
        { provide: DistributedLockService, useValue: lock },
      ],
    }).compile();

    service = module.get(MatchmakingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('joinQueue', () => {
    it('propage l\'erreur de sessionSecurity si player indisponible', async () => {
      sessionSecurity.assertPlayerAvailableForPublicRoom.mockRejectedValue(
        new ConflictException('occupé'),
      );
      await expect(service.joinQueue('p1')).rejects.toThrow(ConflictException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('retourne already_in_queue si player déjà en queue', async () => {
      queue.getScore.mockResolvedValue(1234567890);
      const result = await service.joinQueue('p1');
      expect(result).toEqual({ status: 'already_in_queue' });
      expect(redis.setIfNotExists).not.toHaveBeenCalled();
    });

    it('retourne searching si lock non acquis (autre instance en cours)', async () => {
      // tryWithLock retourne null si lock pas acquis
      lock.tryWithLock.mockResolvedValue(null);
      const result = await service.joinQueue('p1');
      expect(result).toEqual({ status: 'searching' });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('ajoute le joueur à la queue et retourne searching si < 2 joueurs', async () => {
      queue.size.mockResolvedValue(1);
      const result = await service.joinQueue('p1');
      expect(result).toEqual({ status: 'searching' });
      expect(queue.add).toHaveBeenCalledWith('p1', expect.any(Number));
    });

    it('crée une session si >= 2 joueurs en queue', async () => {
      queue.size.mockResolvedValue(2);
      queue.range.mockResolvedValue(['p1', 'p2']);
      // Premier getScore (check déjà-en-queue) → null
      // Puis récupérations de scores pour metrics
      queue.getScore
        .mockResolvedValueOnce(null) // check initial pour p1
        .mockResolvedValueOnce(1000) // metrics p1
        .mockResolvedValueOnce(1500); // metrics p2

      const result = await service.joinQueue('p1');

      expect(gameSession.createSession).toHaveBeenCalledWith('p1', 'p2');
      expect(queue.remove).toHaveBeenCalledWith('p1', 'p2');
      expect(result).toEqual({ status: 'matched', sessionId: 'session-1' });
    });

    it('retourne searching si range incomplet (data inconsistency)', async () => {
      queue.size.mockResolvedValue(2);
      queue.range.mockResolvedValue(['p1']); // seulement 1 alors que size=2
      const result = await service.joinQueue('p1');
      expect(result).toEqual({ status: 'searching' });
      expect(gameSession.createSession).not.toHaveBeenCalled();
    });

    it('propage l\'erreur si createSession throw (le lock distribué gère la release)', async () => {
      queue.size.mockResolvedValue(2);
      queue.range.mockResolvedValue(['p1', 'p2']);
      gameSession.createSession.mockRejectedValue(new Error('boom'));
      // Simuler que tryWithLock relance l'erreur (comme le ferait la vraie impl)
      lock.tryWithLock.mockImplementation(async (_k, _ttl, fn) => fn());

      await expect(service.joinQueue('p1')).rejects.toThrow('boom');
    });

    it('utilise la clé de lock MATCHMAKING_QUEUE_LOCK_KEY avec TTL >= 10s (bug #6 fix)', async () => {
      await service.joinQueue('p1');
      const [key, ttl] = lock.tryWithLock.mock.calls[0];
      expect(key).toBe('matchmaking:queue:lock');
      expect(ttl).toBeGreaterThanOrEqual(10);
    });

    it('retire les joueurs de la queue AVANT createSession (pas de re-match possible)', async () => {
      queue.size.mockResolvedValue(2);
      queue.range.mockResolvedValue(['p1', 'p2']);
      let removeCalledBeforeCreate = false;
      gameSession.createSession.mockImplementation(async () => {
        removeCalledBeforeCreate = queue.remove.mock.calls.length > 0;
        return { id: 's' };
      });

      await service.joinQueue('p1');
      expect(removeCalledBeforeCreate).toBe(true);
    });
  });

  describe('leaveQueue', () => {
    it('supprime le joueur de la queue', async () => {
      const result = await service.leaveQueue('p1');
      expect(queue.remove).toHaveBeenCalledWith('p1');
      expect(result).toEqual({ status: 'left' });
    });
  });

  describe('getQueueStatus', () => {
    it('retourne queued:true si joueur en queue', async () => {
      sessionSecurity.isPlayerQueued.mockResolvedValue(true);
      const result = await service.getQueueStatus('p1');
      expect(result).toEqual({ queued: true });
    });

    it('retourne queued:false si joueur pas en queue', async () => {
      sessionSecurity.isPlayerQueued.mockResolvedValue(false);
      const result = await service.getQueueStatus('p1');
      expect(result).toEqual({ queued: false });
    });
  });
});

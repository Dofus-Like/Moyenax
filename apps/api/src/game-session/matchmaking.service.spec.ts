import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingService } from './matchmaking.service';
import { GameSessionService } from './game-session.service';
import { RedisService } from '../shared/redis/redis.service';
import { MatchmakingQueueStore } from '../shared/security/matchmaking-queue.store';
import { SessionSecurityService } from '../shared/security/session-security.service';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: RedisService, useValue: redis },
        { provide: MatchmakingQueueStore, useValue: queue },
        { provide: GameSessionService, useValue: gameSession },
        { provide: SessionSecurityService, useValue: sessionSecurity },
        { provide: PerfStatsService, useValue: { recordGameMetric: jest.fn() } },
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
      redis.setIfNotExists.mockResolvedValue(false);
      const result = await service.joinQueue('p1');
      expect(result).toEqual({ status: 'searching' });
      expect(queue.add).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled(); // pas dans le finally si on sort avant
    });

    it('ajoute le joueur à la queue et retourne searching si < 2 joueurs', async () => {
      queue.size.mockResolvedValue(1);
      const result = await service.joinQueue('p1');
      expect(result).toEqual({ status: 'searching' });
      expect(queue.add).toHaveBeenCalledWith('p1', expect.any(Number));
      expect(redis.del).toHaveBeenCalledTimes(1); // finally libère le lock
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

    it('libère toujours le lock dans le finally, même en cas d\'erreur', async () => {
      queue.size.mockResolvedValue(2);
      queue.range.mockResolvedValue(['p1', 'p2']);
      gameSession.createSession.mockRejectedValue(new Error('boom'));

      await expect(service.joinQueue('p1')).rejects.toThrow('boom');
      expect(redis.del).toHaveBeenCalledTimes(1);
    });

    it('utilise la clé de lock MATCHMAKING_QUEUE_LOCK_KEY avec TTL 5s', async () => {
      await service.joinQueue('p1');
      expect(redis.setIfNotExists).toHaveBeenCalledWith(expect.any(String), 'p1', 5);
    });

    /**
     * Test de régression pour la race condition identifiée:
     * - TTL du lock = 5s
     * - Si createSession prend > 5s, le lock expire et un autre client peut matcher avec même joueur
     * On ne peut pas tester directement le timing mais on vérifie qu'on libère proprement.
     */
    it('[concurrence] nettoie même si createSession prend beaucoup de temps', async () => {
      queue.size.mockResolvedValue(2);
      queue.range.mockResolvedValue(['p1', 'p2']);
      gameSession.createSession.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 's' }), 10)),
      );

      await service.joinQueue('p1');
      expect(redis.del).toHaveBeenCalledTimes(1);
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

import { Test, TestingModule } from '@nestjs/testing';
import { TurnService } from './turn.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { SpellsService } from '../spells/spells.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { PerfStatsService } from '../../shared/perf/perf-stats.service';
import { RuntimePerfService } from '../../shared/perf/runtime-perf.service';
import { BadRequestException } from '@nestjs/common';
import { CombatActionType, CombatState, TerrainType } from '@game/shared-types';
import * as gameEngine from '@game/game-engine';

jest.mock('@game/game-engine', () => ({
  canMoveTo: jest.fn(),
  canJumpTo: jest.fn(),
  isInRange: jest.fn(),
  hasLineOfSight: jest.fn(),
}));

describe('TurnService', () => {
  let service: TurnService;
  let redisService: jest.Mocked<RedisService>;
  let sseService: jest.Mocked<SseService>;
  let spellsService: jest.Mocked<SpellsService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let perfLogger: jest.Mocked<PerfLoggerService>;
  let runtimePerf: jest.Mocked<RuntimePerfService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnService,
        {
          provide: RedisService,
          useValue: {
            getJson: jest.fn(),
            setJson: jest.fn(),
          },
        },
        {
          provide: SseService,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: SpellsService,
          useValue: {
            executeEffect: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: PerfLoggerService,
          useValue: {
            logEvent: jest.fn(),
            logDuration: jest.fn(),
            logMetric: jest.fn(),
          },
        },
        {
          provide: RuntimePerfService,
          useValue: {
            getTotalSseEvents: jest.fn().mockReturnValue(0),
          },
        },
        {
          provide: PerfStatsService,
          useValue: { recordGameMetric: jest.fn() },
        },
        {
          provide: (await import('../../shared/security/distributed-lock.service')).DistributedLockService,
          useValue: {
            withLock: jest.fn(async (_k, _ttl, fn) => fn()),
            tryWithLock: jest.fn(async (_k, _ttl, fn) => fn()),
            acquire: jest.fn().mockResolvedValue('test-fingerprint'),
            release: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<TurnService>(TurnService);
    redisService = module.get(RedisService);
    sseService = module.get(SseService);
    spellsService = module.get(SpellsService);
    eventEmitter = module.get(EventEmitter2);
    perfLogger = module.get(PerfLoggerService);
    runtimePerf = module.get(RuntimePerfService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('playAction', () => {
    const sessionId = 'session-123';
    const playerId = 'player-1';

    it('should throw an error if the session is not found', async () => {
      redisService.getJson.mockResolvedValue(null);

      await expect(
        service.playAction(sessionId, playerId, { type: CombatActionType.END_TURN }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw an error if it is not the player turn', async () => {
      redisService.getJson.mockResolvedValue({
        currentTurnPlayerId: 'player-2',
      } as unknown as CombatState);

      await expect(
        service.playAction(sessionId, playerId, { type: CombatActionType.END_TURN }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow MOVE action when valid', async () => {
      const mockState = {
        sessionId,
        currentTurnPlayerId: playerId,
        players: {
          [playerId]: {
            playerId,
            position: { x: 1, y: 1 },
            remainingPm: 3,
            type: 'PLAYER',
            currentVit: 100,
          },
        },
        map: { tiles: [] },
      } as unknown as CombatState;

      redisService.getJson.mockResolvedValue(mockState);
      (gameEngine.canMoveTo as jest.Mock).mockReturnValue(true);

      const action = { type: CombatActionType.MOVE, targetX: 2, targetY: 1 };
      const newState = await service.playAction(sessionId, playerId, action);

      expect(newState.players[playerId].position).toEqual({ x: 2, y: 1 });
      expect(newState.players[playerId].remainingPm).toBe(2);
      expect(sseService.emit).toHaveBeenCalledWith(sessionId, 'STATE_UPDATED', expect.any(Object));
      expect(redisService.setJson).toHaveBeenCalledWith(
        `combat:${sessionId}`,
        expect.any(Object),
        3600,
      );
    });

    it('should allow JUMP action when valid', async () => {
      const mockState = {
        sessionId,
        currentTurnPlayerId: playerId,
        players: {
          [playerId]: {
            playerId,
            position: { x: 1, y: 1 },
            remainingPm: 3,
            type: 'PLAYER',
            currentVit: 100,
          },
        },
        map: { tiles: [] },
      } as unknown as CombatState;

      redisService.getJson.mockResolvedValue(mockState);
      (gameEngine.canJumpTo as jest.Mock).mockReturnValue(true);

      const action = { type: CombatActionType.JUMP, targetX: 3, targetY: 1 };
      const newState = await service.playAction(sessionId, playerId, action);

      expect(newState.players[playerId].position).toEqual({ x: 3, y: 1 });
      expect(newState.players[playerId].remainingPm).toBe(2); // Jump costs 1 PM
      expect(sseService.emit).toHaveBeenCalledWith(sessionId, 'PLAYER_JUMPED', expect.any(Object));
    });

    it('should change turn correctly on END_TURN', async () => {
      const mockState = {
        sessionId,
        currentTurnPlayerId: playerId,
        turnNumber: 1,
        players: {
          [playerId]: {
            playerId,
            type: 'PLAYER',
            buffs: [],
            currentVit: 100,
          },
          'player-2': {
            playerId: 'player-2',
            type: 'PLAYER',
            buffs: [],
            stats: { pa: 6, pm: 3 },
            remainingPa: 0,
            remainingPm: 0,
            spellCooldowns: { spell1: 1 },
            currentVit: 100,
          },
        },
      } as unknown as CombatState;

      redisService.getJson.mockResolvedValue(mockState);

      const action = { type: CombatActionType.END_TURN };
      const newState = await service.playAction(sessionId, playerId, action);

      expect(newState.currentTurnPlayerId).toBe('player-2');
      expect(newState.turnNumber).toBe(2);
      expect(newState.players['player-2'].remainingPa).toBe(6);
      expect(newState.players['player-2'].remainingPm).toBe(3);
      expect(newState.players['player-2'].spellCooldowns['spell1']).toBe(0);
      expect(sseService.emit).toHaveBeenCalledWith(sessionId, 'TURN_STARTED', {
        playerId: 'player-2',
      });
    });
  });
});

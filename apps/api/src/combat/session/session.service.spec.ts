import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { PlayerSpellProjectionService } from '../../player/player-spell-projection.service';
import { PlayerStatsService } from '../../player/player-stats.service';
import { MapService } from '../map/map.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { SessionSecurityService } from '../../shared/security/session-security.service';
import { SseTicketService } from '../../shared/security/sse-ticket.service';
import { BadRequestException } from '@nestjs/common';
import * as gameEngine from '@game/game-engine';

jest.mock('@game/game-engine', () => ({
  calculateInitiativeJet: jest.fn().mockReturnValue(100),
}));

describe('SessionService', () => {
  let service: SessionService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let sessionSecurityService: jest.Mocked<SessionSecurityService>;
  let playerStatsService: jest.Mocked<PlayerStatsService>;
  let playerSpellProjection: jest.Mocked<PlayerSpellProjectionService>;
  let mapService: jest.Mocked<MapService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: {
            combatSession: {
              create: jest.fn(),
              updateMany: jest.fn(),
              findUnique: jest.fn(),
            },
            player: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            setJson: jest.fn(),
            getJson: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: SseService,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: PlayerSpellProjectionService,
          useValue: {
            syncPlayerSpells: jest.fn(),
            getCombatSpellDefinitions: jest.fn(),
          },
        },
        {
          provide: PlayerStatsService,
          useValue: {
            getCombatLoadout: jest.fn(),
          },
        },
        {
          provide: MapService,
          useValue: {
            generateCombatMap: jest.fn().mockReturnValue([]),
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
            logDuration: jest.fn(),
            logEvent: jest.fn(),
          },
        },
        {
          provide: SessionSecurityService,
          useValue: {
            assertPlayerAvailableForPublicRoom: jest.fn(),
            assertCanAcceptCombatSession: jest.fn(),
            getCombatSessionForParticipantOrThrow: jest.fn(),
          },
        },
        {
          provide: SseTicketService,
          useValue: {
            issueTicket: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prismaService = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
    redisService = module.get(RedisService);
    sessionSecurityService = module.get(SessionSecurityService);
    playerStatsService = module.get(PlayerStatsService);
    playerSpellProjection = module.get(PlayerSpellProjectionService);
    mapService = module.get(MapService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('challenge', () => {
    it('should throw an error if challenger and target are the same', async () => {
      await expect(service.challenge('player-1', 'player-1')).rejects.toThrow(BadRequestException);
    });

    it('should create a waiting combat session', async () => {
      const mockResult = { id: 'session-id', status: 'WAITING' };
      (prismaService.combatSession.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.challenge('player-1', 'player-2');

      expect(sessionSecurityService.assertPlayerAvailableForPublicRoom).toHaveBeenCalledWith('player-1');
      expect(sessionSecurityService.assertPlayerAvailableForPublicRoom).toHaveBeenCalledWith('player-2');
      expect(prismaService.combatSession.create).toHaveBeenCalledWith({
        data: {
          player1Id: 'player-1',
          player2Id: 'player-2',
          status: 'WAITING',
        },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('accept', () => {
    it('should throw if player2Id is already linked but activate fails', async () => {
      const sessionId = 'session-123';
      const player2Id = 'player-2';

      sessionSecurityService.assertCanAcceptCombatSession.mockResolvedValue({
        id: sessionId,
        player1Id: 'p1',
        player2Id: 'p2',
        status: 'WAITING',
      } as any);

      (prismaService.combatSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.accept(sessionId, player2Id)).rejects.toThrow(BadRequestException);
    });

    it('should initialize combat state, initialize turn, and save to redis', async () => {
      const sessionId = 'session-123';
      const player1Id = 'player-1';
      const player2Id = 'player-2';

      sessionSecurityService.assertCanAcceptCombatSession.mockResolvedValue({
        id: sessionId,
        player1Id,
        player2Id,
        status: 'WAITING',
      } as any);

      (prismaService.combatSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.combatSession.findUnique as jest.Mock).mockResolvedValue({
        id: sessionId,
        player1Id,
        player2Id,
      });

      playerStatsService.getCombatLoadout.mockResolvedValue({ stats: { vit: 100, pa: 6, pm: 3 } } as any);
      playerSpellProjection.getCombatSpellDefinitions.mockResolvedValue([]);
      (prismaService.player.findUnique as jest.Mock).mockResolvedValue({ username: 'Player', skin: 'skin1' });

      const state = await service.accept(sessionId, player2Id);

      expect(state.sessionId).toEqual(sessionId);
      expect(state.turnNumber).toEqual(1);
      expect(state.players[player1Id].type).toBe('PLAYER');
      expect(state.players[player2Id].type).toBe('PLAYER');
      expect(redisService.setJson).toHaveBeenCalledWith(`combat:${sessionId}`, state, 3600);
    });
  });
});

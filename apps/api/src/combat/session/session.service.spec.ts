import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { PlayerSpellProjectionService } from '../../player/player-spell-projection.service';
import { PlayerStatsService } from '../../player/player-stats.service';
import { PerfLoggerService } from '../../shared/perf/perf-logger.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SessionSecurityService } from '../../shared/security/session-security.service';
import { SseTicketService } from '../../shared/security/sse-ticket.service';
import { SseService } from '../../shared/sse/sse.service';
import { MapService } from '../map/map.service';
import { StatsCalculatorService } from '../../player/stats-calculator.service';

import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let sessionSecurityService: jest.Mocked<SessionSecurityService>;
  let playerStatsService: jest.Mocked<PlayerStatsService>;
  let playerSpellProjection: jest.Mocked<PlayerSpellProjectionService>;

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
            gameSession: {
              findFirst: jest.fn(),
            },
            item: {
              findUnique: jest.fn(),
            },
            inventoryItem: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            equipmentSlot: {
              upsert: jest.fn(),
            },
            playerStats: {
              update: jest.fn(),
            },
            playerSpell: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
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
            buildPlayerSpellAssignments: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PlayerStatsService,
          useValue: {
            getCombatLoadout: jest.fn(),
          },
        },
        {
          provide: StatsCalculatorService,
          useValue: {
            computeEffectiveStats: jest.fn().mockResolvedValue({}),
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

      expect(sessionSecurityService.assertPlayerAvailableForPublicRoom).toHaveBeenCalledWith(
        'player-1',
      );
      expect(sessionSecurityService.assertPlayerAvailableForPublicRoom).toHaveBeenCalledWith(
        'player-2',
      );
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

      playerStatsService.getCombatLoadout.mockResolvedValue({
        stats: { vit: 100, pa: 6, pm: 3 },
      } as any);
      playerSpellProjection.getCombatSpellDefinitions.mockResolvedValue([]);
      (prismaService.player.findUnique as jest.Mock).mockResolvedValue({
        username: 'Player',
        skin: 'skin1',
      });

      const state = await service.accept(sessionId, player2Id);

      expect(state.sessionId).toEqual(sessionId);
      expect(state.turnNumber).toEqual(1);
      expect(state.players[player1Id].type).toBe('PLAYER');
      expect(state.players[player2Id].type).toBe('PLAYER');
      expect(redisService.setJson).toHaveBeenCalledWith(`combat:${sessionId}`, state, 3600);
    });
  });

  describe('startQuickVsAiCombat', () => {
    it('links the combat to the active game session so the phase is reconciled at end', async () => {
      jest.spyOn(service as unknown as { getOrCreateBot: () => Promise<{ id: string }> }, 'getOrCreateBot')
        .mockResolvedValue({ id: 'bot-1' });
      const acceptSpy = jest.spyOn(service, 'accept').mockResolvedValue({} as never);

      (prismaService.item.findUnique as jest.Mock).mockResolvedValue({ id: 'ring-1', type: 'ACCESSORY' });
      (prismaService.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: 'inv-1' });
      (prismaService.equipmentSlot.upsert as jest.Mock).mockResolvedValue({});
      (prismaService.playerStats.update as jest.Mock).mockResolvedValue({});
      (prismaService.playerSpell.deleteMany as jest.Mock).mockResolvedValue({});
      (prismaService.gameSession.findFirst as jest.Mock).mockResolvedValue({ id: 'game-session-1' });
      (prismaService.combatSession.create as jest.Mock).mockResolvedValue({ id: 'combat-1' });

      await service.startQuickVsAiCombat('player-1', 'ring-1');

      expect(prismaService.combatSession.create).toHaveBeenCalledWith({
        data: {
          player1Id: 'player-1',
          player2Id: 'bot-1',
          status: 'WAITING',
          gameSessionId: 'game-session-1',
        },
      });
      expect(acceptSpy).toHaveBeenCalledWith('combat-1', 'bot-1');
    });
  });
});

import * as gameEngine from '@game/game-engine';
import type { CombatState} from '@game/shared-types';
import { CombatActionType, TerrainType } from '@game/shared-types';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { PerfStatsService } from '../../shared/perf/perf-stats.service';
import { RedisService } from '../../shared/redis/redis.service';
import { TurnService } from '../turn/turn.service';

import { BotService } from './bot.service';


jest.mock('@game/game-engine', () => ({
  isInRange: jest.fn(),
}));

describe('BotService', () => {
  let service: BotService;
  let turnService: jest.Mocked<TurnService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        {
          provide: TurnService,
          useValue: {
            forcePlayAction: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getJson: jest.fn(),
          },
        },
        {
          provide: PerfStatsService,
          useValue: { recordGameMetric: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BotService>(BotService);
    turnService = module.get(TurnService);
    redisService = module.get(RedisService);

    // Silence console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleTurnStarted', () => {
    const sessionId = 'session-bot';
    const botId = 'bot-123';
    const enemyId = 'player-real';

    it('should ignore if player is not a bot', async () => {
      redisService.getJson.mockResolvedValue({
        players: {
          [botId]: { username: 'RealPlayer' },
        },
      } as unknown as CombatState);

      await service.handleTurnStarted({ sessionId, playerId: botId });

      expect(turnService.forcePlayAction).not.toHaveBeenCalled();
    });

    it('should attack if enemy is in range', async () => {
      const mockState = {
        sessionId,
        map: { width: 10, height: 10, tiles: [] },
        players: {
          [botId]: {
            playerId: botId,
            username: 'Bot_Aggro',
            position: { x: 5, y: 5 },
            remainingPa: 6,
            remainingPm: 3,
            spells: [{ id: 'spell-1', paCost: 3, minRange: 1, maxRange: 1, name: 'Slash' }],
            type: 'PLAYER',
          },
          [enemyId]: {
            playerId: enemyId,
            username: 'Target',
            position: { x: 5, y: 6 },
          },
        },
      } as unknown as CombatState;

      // On simule deux états : un avec PA, un sans PA pour arrêter la récursion
      const stateWithPa = { ...mockState };
      const stateWithoutPa = {
        ...mockState,
        players: {
          ...mockState.players,
          [botId]: { ...mockState.players[botId], remainingPa: 0 },
        },
      };

      redisService.getJson
        .mockResolvedValueOnce(stateWithPa as any)
        .mockResolvedValueOnce(stateWithoutPa as any);
      (gameEngine.isInRange as jest.Mock).mockReturnValue(true);

      // @ts-ignore
      await service.makeMove(sessionId, botId);

      expect(turnService.forcePlayAction).toHaveBeenCalledWith(
        sessionId,
        botId,
        expect.objectContaining({ type: CombatActionType.CAST_SPELL, spellId: 'spell-1' }),
      );
    });

    it('should move towards enemy if out of range', async () => {
      const mockState = {
        sessionId,
        map: {
          width: 10,
          height: 10,
          tiles: [{ x: 5, y: 6, type: TerrainType.GROUND }],
        },
        players: {
          [botId]: {
            playerId: botId,
            username: 'Bot_Aggro',
            position: { x: 5, y: 5 },
            remainingPa: 6,
            remainingPm: 3,
            spells: [{ id: 'spell-1', paCost: 3, minRange: 1, maxRange: 1, name: 'Slash' }],
            type: 'PLAYER',
          },
          [enemyId]: {
            playerId: enemyId,
            username: 'Target',
            position: { x: 5, y: 8 },
          },
        },
      } as unknown as CombatState;

      // Simuler la consommation de PM
      const stateWithPm = { ...mockState };
      const stateWithoutPm = {
        ...mockState,
        players: {
          ...mockState.players,
          [botId]: { ...mockState.players[botId], remainingPm: 0 },
        },
      };

      redisService.getJson
        .mockResolvedValueOnce(stateWithPm as any)
        .mockResolvedValueOnce(stateWithoutPm as any);
      (gameEngine.isInRange as jest.Mock).mockReturnValue(false);

      // @ts-ignore
      await service.makeMove(sessionId, botId);

      expect(turnService.forcePlayAction).toHaveBeenCalledWith(
        sessionId,
        botId,
        expect.objectContaining({ type: CombatActionType.MOVE, targetX: 5, targetY: 6 }),
      );
    });

    it('should recurse with afterMove=true after a movement', async () => {
      const mockState = {
        sessionId,
        map: { width: 10, height: 10, tiles: [{ x: 5, y: 6, type: TerrainType.GROUND }] },
        players: {
          [botId]: {
            playerId: botId,
            username: 'Bot',
            position: { x: 5, y: 5 },
            remainingPa: 6,
            remainingPm: 3,
            spells: [{ id: 'spell-1', paCost: 3, minRange: 1, maxRange: 1, name: 'Slash' }],
            type: 'PLAYER',
          },
          [enemyId]: {
            playerId: enemyId,
            username: 'Target',
            position: { x: 5, y: 7 }, // Need to move one step to be in range (5,6)
          },
        },
      } as unknown as CombatState;

      // Important : On doit vider les PM au 2ème appel pour arrêter la récursion du test
      const stateWithPm = { ...mockState };
      const stateWithoutPm = {
        ...mockState,
        players: {
          ...mockState.players,
          [botId]: { ...mockState.players[botId], remainingPm: 0 },
        },
      };

      redisService.getJson
        .mockResolvedValueOnce(stateWithPm as any)
        .mockResolvedValueOnce(stateWithoutPm as any);

      const spy = jest.spyOn(service as any, 'makeMove');

      // @ts-ignore
      await service.makeMove(sessionId, botId);

      // First call: afterMove=false
      // Second call (after move): afterMove=true
      expect(spy).toHaveBeenCalledWith(sessionId, botId, true);
      spy.mockRestore();
    });

    it('should end turn if no actions possible', async () => {
      const mockState = {
        sessionId,
        map: { width: 10, height: 10, tiles: [] },
        players: {
          [botId]: {
            playerId: botId,
            username: 'Bot_Aggro',
            position: { x: 5, y: 5 },
            remainingPa: 0,
            remainingPm: 0,
            spells: [],
            type: 'PLAYER',
          },
          [enemyId]: {
            playerId: enemyId,
            username: 'Target',
            position: { x: 8, y: 8 },
          },
        },
      } as unknown as CombatState;

      redisService.getJson.mockResolvedValue(mockState);

      // @ts-ignore
      await service.makeMove(sessionId, botId);

      expect(turnService.forcePlayAction).toHaveBeenCalledWith(
        sessionId,
        botId,
        expect.objectContaining({ type: CombatActionType.END_TURN }),
      );
    });
  });
});

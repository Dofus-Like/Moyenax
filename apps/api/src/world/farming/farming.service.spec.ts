import { BadRequestException } from '@nestjs/common';
import { TerrainType } from '@game/shared-types';
import { FarmingService } from './farming.service';

describe('FarmingService', () => {
  const redis = {
    getJson: jest.fn(),
    setJson: jest.fn(),
  };

  const mapGenerator = {
    getOrCreateMap: jest.fn(),
    resetMap: jest.fn(),
  };

  const inventory = {
    addResourceByName: jest.fn(),
  };

  const perfLogger = {
    logEvent: jest.fn(),
  };

  let service: FarmingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mapGenerator.getOrCreateMap.mockResolvedValue({
      seedId: 'FORGE',
      grid: Array.from({ length: 2 }, () => [TerrainType.GROUND, TerrainType.GROUND]),
    });
    mapGenerator.resetMap.mockResolvedValue({
      seedId: 'NATURE',
      grid: Array.from({ length: 2 }, () => [TerrainType.HERB, TerrainType.GROUND]),
    });
    redis.setJson.mockResolvedValue(undefined);
    inventory.addResourceByName.mockResolvedValue(undefined);

    service = new FarmingService(
      redis as any,
      mapGenerator as any,
      inventory as any,
      perfLogger as any,
    );
  });

  it('creates a fresh farming state at round 1 with 4 pips', async () => {
    redis.getJson.mockResolvedValue(null);

    await expect(service.getOrCreateInstance('player-1')).resolves.toEqual(
      expect.objectContaining({
        playerId: 'player-1',
        seedId: 'FORGE',
        round: 1,
        pips: 4,
      }),
    );
    expect(redis.setJson).toHaveBeenCalledWith(
      'farming:player-1',
      expect.objectContaining({ round: 1, pips: 4 }),
      86400,
    );
  });

  it('reuses the existing farming state instead of creating another one', async () => {
    const existing = {
      playerId: 'player-1',
      seedId: 'FORGE',
      map: [],
      round: 3,
      pips: 2,
    };
    redis.getJson.mockResolvedValue(existing);

    await expect(service.getOrCreateInstance('player-1')).resolves.toEqual(existing);
    expect(redis.setJson).not.toHaveBeenCalled();
  });

  it('decrements pips and persists the updated state after a gather', async () => {
    const state = {
      playerId: 'player-1',
      seedId: 'FORGE',
      round: 1,
      pips: 4,
      map: [{ x: 2, y: 3, terrain: TerrainType.GOLD }],
    };
    redis.getJson.mockResolvedValue(state);

    await expect(service.gatherResource('player-1', 2, 3, 2, 2)).resolves.toEqual(
      expect.objectContaining({ pips: 3 }),
    );
    expect(inventory.addResourceByName).toHaveBeenCalledWith('player-1', 'Or');
    expect(redis.setJson).toHaveBeenCalledWith('farming:player-1', expect.objectContaining({ pips: 3 }), 86400);
  });

  it('rejects gather attempts when there is no active farming state', async () => {
    redis.getJson.mockResolvedValue(null);

    await expect(service.gatherResource('player-1', 0, 0, 0, 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('closes farming for the round by setting pips to 0', async () => {
    redis.getJson.mockResolvedValue({
      playerId: 'player-1',
      seedId: 'FORGE',
      round: 2,
      pips: 3,
      map: [],
    });

    await expect(service.endFarmingPhase('player-1')).resolves.toEqual(
      expect.objectContaining({ pips: 0 }),
    );
  });

  it('refills pips back to 4 in debug mode', async () => {
    redis.getJson.mockResolvedValue({
      playerId: 'player-1',
      seedId: 'FORGE',
      round: 2,
      pips: 0,
      map: [],
    });

    await expect(service.debugRefillPips('player-1')).resolves.toEqual(
      expect.objectContaining({ pips: 4 }),
    );
  });

  it('advances to the next round and restores pips', async () => {
    redis.getJson.mockResolvedValue({
      playerId: 'player-1',
      seedId: 'FORGE',
      round: 2,
      pips: 0,
      map: [],
    });

    await expect(service.nextRound('player-1')).resolves.toEqual(
      expect.objectContaining({ round: 3, pips: 4 }),
    );
  });

  it('refreshes both players farming states after a combat ends', async () => {
    redis.getJson
      .mockResolvedValueOnce({ playerId: 'winner', seedId: 'FORGE', round: 2, pips: 0, map: [] })
      .mockResolvedValueOnce({ playerId: 'loser', seedId: 'FORGE', round: 4, pips: 1, map: [] });

    await service.handleCombatEnded({
      winnerId: 'winner',
      loserId: 'loser',
      sessionId: 'combat-1',
    });

    expect(redis.setJson).toHaveBeenNthCalledWith(
      1,
      'farming:winner',
      expect.objectContaining({ round: 3, pips: 4 }),
      86400,
    );
    expect(redis.setJson).toHaveBeenNthCalledWith(
      2,
      'farming:loser',
      expect.objectContaining({ round: 5, pips: 4 }),
      86400,
    );
  });

  it('skips missing farming states when combat ended cleanup runs', async () => {
    redis.getJson.mockResolvedValue(null);

    await expect(
      service.handleCombatEnded({
        winnerId: 'winner',
        loserId: 'loser',
        sessionId: 'combat-1',
      }),
    ).resolves.toBeUndefined();
    expect(redis.setJson).not.toHaveBeenCalled();
  });
});

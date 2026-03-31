import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MatchmakingQueueStore } from './matchmaking-queue.store';
import { SessionSecurityService } from './session-security.service';

describe('SessionSecurityService', () => {
  const prisma = {
    player: {
      findUnique: jest.fn(),
    },
    combatSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    gameSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const matchmakingQueue = {
    isQueued: jest.fn(),
  };

  let service: SessionSecurityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionSecurityService(prisma as any, matchmakingQueue as unknown as MatchmakingQueueStore);
    matchmakingQueue.isQueued.mockResolvedValue(false);
    prisma.gameSession.findFirst.mockResolvedValue(null);
    prisma.combatSession.findFirst.mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue({ username: 'Warrior' });
  });

  it('rejects room creation when the player is already queued', async () => {
    matchmakingQueue.isQueued.mockResolvedValue(true);

    await expect(service.assertPlayerAvailableForPublicRoom('player-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects targeted challenge acceptance by a third party', async () => {
    prisma.combatSession.findUnique.mockResolvedValue({
      id: 'combat-1',
      status: 'WAITING',
      player1Id: 'challenger',
      player2Id: 'invited-player',
    });

    await expect(service.assertCanAcceptCombatSession('combat-1', 'random-player')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows the invited player to accept a targeted challenge without conflicting on the same session', async () => {
    const session = {
      id: 'combat-1',
      status: 'WAITING',
      player1Id: 'challenger',
      player2Id: 'invited-player',
    };
    prisma.combatSession.findUnique.mockResolvedValue(session);

    const availabilitySpy = jest
      .spyOn(service, 'assertPlayerAvailableForPublicRoom')
      .mockResolvedValue(undefined);

    await expect(service.assertCanAcceptCombatSession('combat-1', 'invited-player')).resolves.toEqual(
      session,
    );
    expect(availabilitySpy).toHaveBeenCalledWith('invited-player', {
      ignoreCombatSessionId: 'combat-1',
    });
  });

  it('ignores the linked game session when accepting an internal combat created from ready state', async () => {
    const session = {
      id: 'combat-1',
      status: 'WAITING',
      player1Id: 'challenger',
      player2Id: 'invited-player',
      gameSessionId: 'game-session-1',
    };
    prisma.combatSession.findUnique.mockResolvedValue(session);

    const availabilitySpy = jest
      .spyOn(service, 'assertPlayerAvailableForPublicRoom')
      .mockResolvedValue(undefined);

    await expect(service.assertCanAcceptCombatSession('combat-1', 'invited-player')).resolves.toEqual(
      session,
    );
    expect(availabilitySpy).toHaveBeenCalledWith('invited-player', {
      ignoreCombatSessionId: 'combat-1',
      ignoreGameSessionId: 'game-session-1',
    });
  });
});

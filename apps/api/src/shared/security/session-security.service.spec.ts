import { ConflictException, ForbiddenException } from '@nestjs/common';

import type { MatchmakingQueueStore } from './matchmaking-queue.store';
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
    service = new SessionSecurityService(
      prisma as any,
      matchmakingQueue as unknown as MatchmakingQueueStore,
    );
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

    await expect(
      service.assertCanAcceptCombatSession('combat-1', 'random-player'),
    ).rejects.toBeInstanceOf(ForbiddenException);
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

    await expect(
      service.assertCanAcceptCombatSession('combat-1', 'invited-player'),
    ).resolves.toEqual(session);
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

    await expect(
      service.assertCanAcceptCombatSession('combat-1', 'invited-player'),
    ).resolves.toEqual(session);
    expect(availabilitySpy).toHaveBeenCalledWith('invited-player', {
      ignoreCombatSessionId: 'combat-1',
      ignoreGameSessionId: 'game-session-1',
    });
  });

  it('throws ConflictException when player already has an open game session', async () => {
    prisma.gameSession.findFirst.mockResolvedValue({ id: 'gs-1', status: 'WAITING' });

    await expect(service.assertPlayerAvailableForPublicRoom('player-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws ConflictException when player already has an open combat session', async () => {
    prisma.combatSession.findFirst.mockResolvedValue({ id: 'cs-1', status: 'WAITING' });

    await expect(service.assertPlayerAvailableForPublicRoom('player-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('resolves without error when no open sessions exist', async () => {
    await expect(service.assertPlayerAvailableForPublicRoom('player-1')).resolves.toBeUndefined();
  });

  describe('getCurrentOpenGameSession', () => {
    it('returns the most recent open game session for the player', async () => {
      const session = { id: 'gs-1', status: 'WAITING', player1Id: 'player-1', player2Id: null };
      prisma.gameSession.findFirst.mockResolvedValue(session);

      await expect(service.getCurrentOpenGameSession('player-1')).resolves.toEqual(session);
    });

    it('returns null when no open session exists', async () => {
      prisma.gameSession.findFirst.mockResolvedValue(null);

      await expect(service.getCurrentOpenGameSession('player-1')).resolves.toBeNull();
    });
  });

  describe('getGameSessionForParticipantOrThrow', () => {
    it('throws NotFoundException when session does not exist', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      prisma.gameSession.findUnique.mockResolvedValue(null);

      await expect(
        service.getGameSessionForParticipantOrThrow('gs-1', 'player-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when user is not a participant', async () => {
      prisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs-1',
        player1Id: 'alice',
        player2Id: 'bob',
      });

      await expect(
        service.getGameSessionForParticipantOrThrow('gs-1', 'charlie'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns session when user is player1', async () => {
      const session = { id: 'gs-1', player1Id: 'player-1', player2Id: 'player-2' };
      prisma.gameSession.findUnique.mockResolvedValue(session);

      await expect(
        service.getGameSessionForParticipantOrThrow('gs-1', 'player-1'),
      ).resolves.toEqual(session);
    });

    it('returns session when user is player2', async () => {
      const session = { id: 'gs-1', player1Id: 'player-1', player2Id: 'player-2' };
      prisma.gameSession.findUnique.mockResolvedValue(session);

      await expect(
        service.getGameSessionForParticipantOrThrow('gs-1', 'player-2'),
      ).resolves.toEqual(session);
    });
  });

  describe('assertCanJoinGameSession', () => {
    it('throws NotFoundException when session does not exist', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      prisma.gameSession.findUnique.mockResolvedValue(null);

      await expect(service.assertCanJoinGameSession('gs-1', 'player-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when user tries to join their own session', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      prisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs-1',
        player1Id: 'player-1',
        status: 'WAITING',
        player2Id: null,
      });

      await expect(service.assertCanJoinGameSession('gs-1', 'player-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException when session is already full', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      prisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs-1',
        player1Id: 'alice',
        status: 'WAITING',
        player2Id: 'bob',
      });

      await expect(service.assertCanJoinGameSession('gs-1', 'player-2')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns session when join conditions are met', async () => {
      const session = { id: 'gs-1', player1Id: 'alice', status: 'WAITING', player2Id: null };
      prisma.gameSession.findUnique.mockResolvedValue(session);

      jest.spyOn(service, 'assertPlayerAvailableForPublicRoom').mockResolvedValue(undefined);

      await expect(service.assertCanJoinGameSession('gs-1', 'bob')).resolves.toEqual(session);
    });
  });

  describe('getCombatSessionForParticipantOrThrow', () => {
    it('throws NotFoundException when combat session does not exist', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      prisma.combatSession.findUnique.mockResolvedValue(null);

      await expect(
        service.getCombatSessionForParticipantOrThrow('cs-1', 'player-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when user is not a participant', async () => {
      prisma.combatSession.findUnique.mockResolvedValue({
        id: 'cs-1',
        player1Id: 'alice',
        player2Id: 'bob',
      });

      await expect(
        service.getCombatSessionForParticipantOrThrow('cs-1', 'charlie'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns session when user is a valid participant', async () => {
      const session = { id: 'cs-1', player1Id: 'player-1', player2Id: 'player-2' };
      prisma.combatSession.findUnique.mockResolvedValue(session);

      await expect(
        service.getCombatSessionForParticipantOrThrow('cs-1', 'player-1'),
      ).resolves.toEqual(session);
    });
  });

  describe('assertCanAcceptCombatSession - edge cases', () => {
    it('throws NotFoundException when combat session does not exist', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      prisma.combatSession.findUnique.mockResolvedValue(null);

      await expect(
        service.assertCanAcceptCombatSession('cs-1', 'player-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when creator tries to accept own challenge', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      prisma.combatSession.findUnique.mockResolvedValue({
        id: 'cs-1',
        status: 'WAITING',
        player1Id: 'creator',
        player2Id: null,
      });

      await expect(
        service.assertCanAcceptCombatSession('cs-1', 'creator'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when session status is not WAITING', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      prisma.combatSession.findUnique.mockResolvedValue({
        id: 'cs-1',
        status: 'ACTIVE',
        player1Id: 'alice',
        player2Id: null,
      });

      await expect(
        service.assertCanAcceptCombatSession('cs-1', 'bob'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('bypasses availability check for the Bot player', async () => {
      prisma.combatSession.findUnique.mockResolvedValue({
        id: 'cs-1',
        status: 'WAITING',
        player1Id: 'player-1',
        player2Id: null,
        gameSessionId: null,
      });
      prisma.player.findUnique.mockResolvedValue({ username: 'Bot' });

      const availabilitySpy = jest
        .spyOn(service, 'assertPlayerAvailableForPublicRoom')
        .mockResolvedValue(undefined);

      await service.assertCanAcceptCombatSession('cs-1', 'bot-id');

      expect(availabilitySpy).not.toHaveBeenCalled();
    });
  });

  describe('assertCanEndGameSession', () => {
    it('throws ForbiddenException when non-creator tries to cancel a waiting session', async () => {
      prisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs-1',
        player1Id: 'creator',
        player2Id: null,
        status: 'WAITING',
      });

      await expect(
        service.assertCanEndGameSession('gs-1', 'other-player'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows the creator to cancel a waiting session', async () => {
      const session = { id: 'gs-1', player1Id: 'creator', player2Id: null, status: 'WAITING' };
      prisma.gameSession.findUnique.mockResolvedValue(session);

      await expect(service.assertCanEndGameSession('gs-1', 'creator')).resolves.toEqual(session);
    });

    it('allows any participant to end an active session', async () => {
      const session = { id: 'gs-1', player1Id: 'player-1', player2Id: 'player-2', status: 'ACTIVE' };
      prisma.gameSession.findUnique.mockResolvedValue(session);

      await expect(service.assertCanEndGameSession('gs-1', 'player-2')).resolves.toEqual(session);
    });
  });
});

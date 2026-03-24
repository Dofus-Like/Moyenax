import { BadRequestException, ConflictException } from '@nestjs/common';
import { GameSessionService } from './game-session.service';

describe('GameSessionService', () => {
  const prisma = {
    player: {
      findUnique: jest.fn(),
    },
    gameSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const sse = {
    emit: jest.fn(),
  };

  const sessionService = {
    startSessionCombat: jest.fn(),
  };

  const sessionSecurity = {
    assertCanJoinGameSession: jest.fn(),
    assertCanEndGameSession: jest.fn(),
    getGameSessionForParticipantOrThrow: jest.fn(),
    getCurrentOpenGameSession: jest.fn(),
    assertPlayerAvailableForPublicRoom: jest.fn(),
  };

  const sseTickets = {
    issueTicket: jest.fn(),
  };

  let service: GameSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.player.findUnique.mockResolvedValue(null);
    service = new GameSessionService(
      prisma as any,
      sse as any,
      sessionService as any,
      sessionSecurity as any,
      sseTickets as any,
    );
  });

  it('rejects a private room join when the race-safe update no longer matches', async () => {
    sessionSecurity.assertCanJoinGameSession.mockResolvedValue(undefined);
    prisma.gameSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.joinPrivateSession('session-1', 'player-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('emits an update when a private room join succeeds', async () => {
    const updatedSession = {
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
      status: 'ACTIVE',
    };
    sessionSecurity.assertCanJoinGameSession.mockResolvedValue(undefined);
    prisma.gameSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.gameSession.findUnique.mockResolvedValue(updatedSession);

    await expect(service.joinPrivateSession('session-1', 'player-2')).resolves.toEqual(updatedSession);
    expect(sse.emit).toHaveBeenCalledWith('game-session:session-1', 'SESSION_UPDATED', updatedSession);
  });

  it('maps a unique constraint collision to a room conflict error', async () => {
    const uniqueConstraintError = { code: 'P2002' };
    sessionSecurity.assertPlayerAvailableForPublicRoom.mockResolvedValue(undefined);
    prisma.gameSession.create.mockRejectedValue(uniqueConstraintError);

    await expect(service.createSession('player-1', null)).rejects.toBeInstanceOf(ConflictException);
  });
});

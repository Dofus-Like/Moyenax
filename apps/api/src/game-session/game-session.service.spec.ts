import { BadRequestException, ConflictException } from '@nestjs/common';
import { GameSessionService } from './game-session.service';

describe('GameSessionService', () => {
  const prisma = {
    $transaction: jest.fn(),
    player: {
      findUnique: jest.fn(),
    },
    playerStats: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    playerSpell: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    equipmentSlot: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    sessionItem: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    combatSession: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
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

  const redis = {
    del: jest.fn(),
  };

  const sessionService = {
    startSessionCombat: jest.fn(),
    endCombat: jest.fn(),
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

  const statsCalculator = {
    computeEffectiveStatsFromSnapshot: jest.fn(),
  };

  const playerSpellProjection = {
    buildPlayerSpellAssignments: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  let service: GameSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.player.findUnique.mockResolvedValue(null);
    prisma.playerStats.findUnique.mockResolvedValue({
      playerId: 'player-1',
      baseVit: 100,
      baseAtk: 10,
      baseMag: 5,
      baseDef: 5,
      baseRes: 5,
      baseIni: 10,
      basePa: 6,
      basePm: 3,
    });
    prisma.equipmentSlot.findMany.mockResolvedValue([]);
    prisma.sessionItem.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (operations: any[]) => Promise.all(operations));
    prisma.playerStats.update.mockResolvedValue(undefined);
    prisma.playerSpell.deleteMany.mockResolvedValue(undefined);
    prisma.playerSpell.createMany.mockResolvedValue(undefined);
    prisma.equipmentSlot.updateMany.mockResolvedValue({ count: 0 });
    prisma.sessionItem.deleteMany.mockResolvedValue({ count: 0 });
    prisma.combatSession.findFirst.mockResolvedValue(null);
    prisma.combatSession.findMany.mockResolvedValue([]);
    prisma.combatSession.findUnique.mockResolvedValue(null);
    prisma.combatSession.updateMany.mockResolvedValue({ count: 0 });
    redis.del.mockResolvedValue(undefined);
    statsCalculator.computeEffectiveStatsFromSnapshot.mockReturnValue({
      vit: 100,
      atk: 10,
      mag: 5,
      def: 5,
      res: 5,
      ini: 10,
      pa: 6,
      pm: 3,
      baseVit: 100,
      baseAtk: 10,
      baseMag: 5,
      baseDef: 5,
      baseRes: 5,
      baseIni: 10,
      basePa: 6,
      basePm: 3,
    });
    playerSpellProjection.buildPlayerSpellAssignments.mockImplementation(async (playerId: string) => [
      { playerId, spellId: 'spell-claque-id', level: 1 },
    ]);
    service = new GameSessionService(
      prisma as any,
      redis as any,
      sse as any,
      sessionService as any,
      sessionSecurity as any,
      sseTickets as any,
      statsCalculator as any,
      playerSpellProjection as any,
      eventEmitter as any,
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

  it('creates a waiting private room for a single player', async () => {
    const createdSession = {
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: null,
      status: 'WAITING',
      phase: 'FARMING',
    };
    sessionSecurity.assertPlayerAvailableForPublicRoom.mockResolvedValue(undefined);
    prisma.gameSession.create.mockResolvedValue(createdSession);

    await expect(service.createSession('player-1', null)).resolves.toEqual(createdSession);
    expect(sessionSecurity.assertPlayerAvailableForPublicRoom).toHaveBeenCalledTimes(1);
    expect(sessionSecurity.assertPlayerAvailableForPublicRoom).toHaveBeenCalledWith('player-1');
    expect(prisma.gameSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          player1Id: 'player-1',
          player2Id: null,
          status: 'WAITING',
        }),
      }),
    );
  });

  it('creates an active session when an opponent is provided', async () => {
    const createdSession = {
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
      status: 'ACTIVE',
      phase: 'FARMING',
    };
    sessionSecurity.assertPlayerAvailableForPublicRoom.mockResolvedValue(undefined);
    prisma.gameSession.create.mockResolvedValue(createdSession);

    await expect(service.createSession('player-1', 'player-2')).resolves.toEqual(createdSession);
    expect(sessionSecurity.assertPlayerAvailableForPublicRoom).toHaveBeenNthCalledWith(1, 'player-1');
    expect(sessionSecurity.assertPlayerAvailableForPublicRoom).toHaveBeenNthCalledWith(2, 'player-2');
    expect(prisma.gameSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          player1Id: 'player-1',
          player2Id: 'player-2',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('cleans stale standalone combats before creating a VS AI session', async () => {
    const createdSession = {
      id: 'session-vs-ai',
      player1Id: 'player-1',
      player2Id: 'bot-1',
      status: 'ACTIVE',
      phase: 'FARMING',
    };

    prisma.player.findUnique.mockResolvedValue({ id: 'bot-1', username: 'Bot' });
    prisma.combatSession.findMany.mockResolvedValue([{ id: 'combat-stale-1' }, { id: 'combat-stale-2' }]);
    sessionSecurity.assertPlayerAvailableForPublicRoom.mockResolvedValue(undefined);
    prisma.gameSession.create.mockResolvedValue(createdSession);

    await expect(service.createVsAiSession('player-1', 'bot-1')).resolves.toEqual(createdSession);

    expect(prisma.combatSession.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['combat-stale-1', 'combat-stale-2'] } },
      data: {
        status: 'FINISHED',
        endedAt: expect.any(Date),
      },
    });
    expect(redis.del).toHaveBeenNthCalledWith(1, 'combat:combat-stale-1');
    expect(redis.del).toHaveBeenNthCalledWith(2, 'combat:combat-stale-2');
    expect(prisma.gameSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          player1Id: 'player-1',
          player2Id: 'bot-1',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('starts the linked combat when the second player marks ready', async () => {
    const session = {
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
      player1Ready: true,
      player2Ready: false,
      status: 'ACTIVE',
      phase: 'FARMING',
      combats: [],
    };
    const updatedReadySession = {
      ...session,
      player2Ready: true,
    };
    const fightingSession = {
      ...updatedReadySession,
      phase: 'FIGHTING',
      player1Ready: false,
      player2Ready: false,
    };
    sessionSecurity.getGameSessionForParticipantOrThrow.mockResolvedValue(session);
    prisma.gameSession.update
      .mockResolvedValueOnce(updatedReadySession)
      .mockResolvedValueOnce(fightingSession);
    prisma.gameSession.findUnique.mockResolvedValue(session);
    sessionService.startSessionCombat.mockResolvedValue({ id: 'combat-1' });

    await expect(service.setReady('session-1', 'player-2', true)).resolves.toEqual(updatedReadySession);
    expect(sessionService.startSessionCombat).toHaveBeenCalledWith('player-1', 'player-2', 'session-1');
    expect(sse.emit).toHaveBeenNthCalledWith(
      1,
      'game-session:session-1',
      'SESSION_UPDATED',
      updatedReadySession,
    );
    expect(sse.emit).toHaveBeenNthCalledWith(
      2,
      'game-session:session-1',
      'SESSION_UPDATED',
      fightingSession,
    );
  });

  it('ends the active linked combat when a player abandons the session', async () => {
    const activeCombat = {
      id: 'combat-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
      status: 'ACTIVE',
    };
    const sessionToEnd = {
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
    };
    const finishedSession = {
      id: 'session-1',
      status: 'FINISHED',
      player1Ready: false,
      player2Ready: false,
    };
    sessionSecurity.assertCanEndGameSession.mockResolvedValue(sessionToEnd);
    prisma.combatSession.findFirst.mockResolvedValue(activeCombat);
    prisma.gameSession.update.mockResolvedValue(finishedSession);
    sessionService.endCombat.mockResolvedValue(undefined);

    await expect(service.endSession('session-1', 'player-1')).resolves.toEqual(finishedSession);
    expect(sessionService.endCombat).toHaveBeenCalledWith('combat-1', 'player-2', 'player-1');
    expect(sse.emit).toHaveBeenCalledWith('game-session:session-1', 'SESSION_UPDATED', finishedSession);
  });

  it('cleans farming state for both players when a session is abandoned', async () => {
    sessionSecurity.assertCanEndGameSession.mockResolvedValue({
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
    });
    prisma.gameSession.update.mockResolvedValue({ id: 'session-1', status: 'FINISHED' });

    await service.endSession('session-1', 'player-1');

    expect(redis.del).toHaveBeenNthCalledWith(1, 'farming:player-1');
    expect(redis.del).toHaveBeenNthCalledWith(2, 'farming:player-2');
  });

  it('removes temporary session items and unequips their slots when a session ends', async () => {
    sessionSecurity.assertCanEndGameSession.mockResolvedValue({
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
    });
    prisma.sessionItem.findMany.mockResolvedValue([{ id: 'si-1' }, { id: 'si-2' }]);
    prisma.gameSession.update.mockResolvedValue({ id: 'session-1', status: 'FINISHED' });

    await service.endSession('session-1', 'player-1');

    expect(prisma.equipmentSlot.updateMany).toHaveBeenCalledWith({
      where: {
        playerId: { in: ['player-1', 'player-2'] },
        sessionItemId: { in: ['si-1', 'si-2'] },
      },
      data: { sessionItemId: null },
    });
    expect(prisma.sessionItem.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
    });
  });

  it('recomputes persistent stats and clears projected spells after session cleanup', async () => {
    sessionSecurity.assertCanEndGameSession.mockResolvedValue({
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
    });
    prisma.gameSession.update.mockResolvedValue({ id: 'session-1', status: 'FINISHED' });

    await service.endSession('session-1', 'player-1');

    expect(statsCalculator.computeEffectiveStatsFromSnapshot).toHaveBeenCalledTimes(2);
    expect(prisma.playerStats.update).toHaveBeenCalledTimes(2);
    expect(prisma.playerSpell.deleteMany).toHaveBeenCalledTimes(2);
  });

  it('restores persistent spells after removing session equipment', async () => {
    sessionSecurity.assertCanEndGameSession.mockResolvedValue({
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
    });
    playerSpellProjection.buildPlayerSpellAssignments
      .mockResolvedValueOnce([{ playerId: 'player-1', spellId: 'spell-1', level: 1 }])
      .mockResolvedValueOnce([{ playerId: 'player-2', spellId: 'spell-2', level: 1 }]);
    prisma.gameSession.update.mockResolvedValue({ id: 'session-1', status: 'FINISHED' });

    await service.endSession('session-1', 'player-1');

    expect(prisma.playerSpell.createMany).toHaveBeenCalledTimes(2);
    expect(prisma.playerSpell.createMany).toHaveBeenCalledWith({
      data: [{ playerId: 'player-1', spellId: 'spell-1', level: 1 }],
    });
  });

  it('cleans session artifacts when the best-of is over after a combat end event', async () => {
    prisma.combatSession.findFirst.mockResolvedValue(null);
    prisma.combatSession.findUnique = jest.fn().mockResolvedValue({
      gameSessionId: 'session-1',
    });
    prisma.gameSession.findUnique.mockResolvedValue({
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
      player1Wins: 2,
      player2Wins: 1,
      currentRound: 3,
    });
    prisma.gameSession.update.mockResolvedValue({
      id: 'session-1',
      status: 'FINISHED',
      player1Wins: 3,
      player2Wins: 1,
      currentRound: 4,
    });

    await service.handleCombatEnded({
      winnerId: 'player-1',
      loserId: 'player-2',
      sessionId: 'combat-1',
    });

    expect(redis.del).toHaveBeenCalledWith('farming:player-1');
    expect(redis.del).toHaveBeenCalledWith('farming:player-2');
    expect(sse.emit).toHaveBeenCalledWith(
      'game-session:session-1',
      'SESSION_UPDATED',
      expect.objectContaining({ status: 'FINISHED' }),
    );
  });

  it('does not clean farming state when the match continues to the next round', async () => {
    prisma.combatSession.findUnique = jest.fn().mockResolvedValue({
      gameSessionId: 'session-1',
    });
    prisma.gameSession.findUnique.mockResolvedValue({
      id: 'session-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
      player1Wins: 1,
      player2Wins: 1,
      currentRound: 2,
    });
    prisma.gameSession.update.mockResolvedValue({
      id: 'session-1',
      status: 'ACTIVE',
      player1Wins: 2,
      player2Wins: 1,
      currentRound: 3,
    });

    await service.handleCombatEnded({
      winnerId: 'player-1',
      loserId: 'player-2',
      sessionId: 'combat-1',
    });

    expect(redis.del).not.toHaveBeenCalled();
    expect(prisma.sessionItem.deleteMany).not.toHaveBeenCalled();
  });
});

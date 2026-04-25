import { BadRequestException } from '@nestjs/common';
import { GameSessionController } from './game-session.controller';

describe('GameSessionController', () => {
  const matchmakingService = {
    joinQueue: jest.fn(),
    leaveQueue: jest.fn(),
    getQueueStatus: jest.fn(),
  };

  const gameSessionService = {
    getCurrentSession: jest.fn(),
    getSessionInventory: jest.fn(),
    setReady: jest.fn(),
    createSession: jest.fn(),
    getWaitingSessions: jest.fn(),
    joinPrivateSession: jest.fn(),
    createVsAiSession: jest.fn(),
    endSession: jest.fn(),
    issueStreamTicket: jest.fn(),
    forceReset: jest.fn(),
  };

  const sseService = {
    getStream: jest.fn(),
  };

  const sessionService = {
    getOrCreateBotPlayer: jest.fn(),
  };

  let controller: GameSessionController;

  const req = { user: { id: 'player-1' } };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new GameSessionController(
      matchmakingService as any,
      gameSessionService as any,
      sseService as any,
      sessionService as any,
    );
  });

  describe('joinQueue', () => {
    it('delegates to matchmakingService.joinQueue', async () => {
      matchmakingService.joinQueue.mockResolvedValue({ queued: true });

      const result = await controller.joinQueue(req);

      expect(matchmakingService.joinQueue).toHaveBeenCalledWith('player-1');
      expect(result).toEqual({ queued: true });
    });
  });

  describe('leaveQueue', () => {
    it('delegates to matchmakingService.leaveQueue', async () => {
      matchmakingService.leaveQueue.mockResolvedValue({ queued: false });

      const result = await controller.leaveQueue(req);

      expect(matchmakingService.leaveQueue).toHaveBeenCalledWith('player-1');
      expect(result).toEqual({ queued: false });
    });
  });

  describe('getQueueStatus', () => {
    it('delegates to matchmakingService.getQueueStatus', async () => {
      matchmakingService.getQueueStatus.mockResolvedValue({ queued: false, position: null });

      const result = await controller.getQueueStatus(req);

      expect(matchmakingService.getQueueStatus).toHaveBeenCalledWith('player-1');
      expect(result).toEqual({ queued: false, position: null });
    });
  });

  describe('getActiveSession', () => {
    it('returns the current session for the player', async () => {
      gameSessionService.getCurrentSession.mockResolvedValue({ id: 'session-1', status: 'ACTIVE' });

      const result = await controller.getActiveSession(req);

      expect(result).toEqual({ id: 'session-1', status: 'ACTIVE' });
    });
  });

  describe('getInventory', () => {
    it('returns empty array when no active session', async () => {
      gameSessionService.getCurrentSession.mockResolvedValue(null);

      const result = await controller.getInventory(req);

      expect(result).toEqual([]);
    });

    it('returns empty array when session is not ACTIVE', async () => {
      gameSessionService.getCurrentSession.mockResolvedValue({ id: 'session-1', status: 'WAITING' });

      const result = await controller.getInventory(req);

      expect(result).toEqual([]);
    });

    it('returns session inventory when session is ACTIVE', async () => {
      gameSessionService.getCurrentSession.mockResolvedValue({ id: 'session-1', status: 'ACTIVE' });
      gameSessionService.getSessionInventory.mockResolvedValue([{ id: 'item-1' }]);

      const result = await controller.getInventory(req);

      expect(gameSessionService.getSessionInventory).toHaveBeenCalledWith('session-1', 'player-1');
      expect(result).toEqual([{ id: 'item-1' }]);
    });
  });

  describe('toggleReady', () => {
    it('throws BadRequestException when body.ready is not a boolean', async () => {
      await expect(
        controller.toggleReady(req, { ready: undefined, sessionId: undefined }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when no active session', async () => {
      gameSessionService.getCurrentSession.mockResolvedValue(null);

      await expect(
        controller.toggleReady(req, { ready: true }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when session is not ACTIVE', async () => {
      gameSessionService.getCurrentSession.mockResolvedValue({ id: 'session-1', status: 'WAITING' });

      await expect(
        controller.toggleReady(req, { ready: true }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('calls setReady and returns result when session is ACTIVE', async () => {
      gameSessionService.getCurrentSession.mockResolvedValue({ id: 'session-1', status: 'ACTIVE' });
      gameSessionService.setReady.mockResolvedValue({ id: 'session-1', player1Ready: true });

      const result = await controller.toggleReady(req, { ready: true });

      expect(gameSessionService.setReady).toHaveBeenCalledWith('session-1', 'player-1', true);
      expect(result).toEqual({ id: 'session-1', player1Ready: true });
    });

    it('fetches session by sessionId when body.sessionId is provided', async () => {
      gameSessionService.getCurrentSession.mockResolvedValue({ id: 'session-2', status: 'ACTIVE' });
      gameSessionService.setReady.mockResolvedValue({ id: 'session-2', player1Ready: false });

      await controller.toggleReady(req, { ready: false, sessionId: 'session-2' });

      expect(gameSessionService.getCurrentSession).toHaveBeenCalledWith('player-1', 'session-2');
    });
  });

  describe('createPrivateSession', () => {
    it('delegates to gameSessionService.createSession with null partner', async () => {
      gameSessionService.createSession.mockResolvedValue({ id: 'new-session' });

      const result = await controller.createPrivateSession(req);

      expect(gameSessionService.createSession).toHaveBeenCalledWith('player-1', null);
      expect(result).toEqual({ id: 'new-session' });
    });
  });

  describe('getWaitingSessions', () => {
    it('returns all waiting sessions', async () => {
      gameSessionService.getWaitingSessions.mockResolvedValue([{ id: 'gs-1' }]);

      const result = await controller.getWaitingSessions();

      expect(result).toEqual([{ id: 'gs-1' }]);
    });
  });

  describe('joinPrivateSession', () => {
    it('delegates to gameSessionService.joinPrivateSession', async () => {
      gameSessionService.joinPrivateSession.mockResolvedValue({ id: 'session-1', player2Id: 'player-1' });

      const result = await controller.joinPrivateSession('session-1', req);

      expect(gameSessionService.joinPrivateSession).toHaveBeenCalledWith('session-1', 'player-1');
      expect(result).toEqual({ id: 'session-1', player2Id: 'player-1' });
    });
  });

  describe('startVsAi', () => {
    it('creates bot player then starts VS AI session', async () => {
      sessionService.getOrCreateBotPlayer.mockResolvedValue({ id: 'bot-1' });
      gameSessionService.createVsAiSession.mockResolvedValue({ id: 'ai-session' });

      const result = await controller.startVsAi(req);

      expect(sessionService.getOrCreateBotPlayer).toHaveBeenCalled();
      expect(gameSessionService.createVsAiSession).toHaveBeenCalledWith('player-1', 'bot-1');
      expect(result).toEqual({ id: 'ai-session' });
    });
  });

  describe('endSession', () => {
    it('delegates to gameSessionService.endSession', async () => {
      gameSessionService.endSession.mockResolvedValue({ id: 'session-1', status: 'FINISHED' });

      const result = await controller.endSession('session-1', req);

      expect(gameSessionService.endSession).toHaveBeenCalledWith('session-1', 'player-1');
      expect(result).toEqual({ id: 'session-1', status: 'FINISHED' });
    });
  });

  describe('issueStreamTicket', () => {
    it('delegates to gameSessionService.issueStreamTicket', async () => {
      gameSessionService.issueStreamTicket.mockResolvedValue({ ticket: 'tok-abc' });

      const result = await controller.issueStreamTicket('session-1', req);

      expect(gameSessionService.issueStreamTicket).toHaveBeenCalledWith('session-1', 'player-1');
      expect(result).toEqual({ ticket: 'tok-abc' });
    });
  });

  describe('resetSession', () => {
    it('delegates to gameSessionService.forceReset', async () => {
      gameSessionService.forceReset.mockResolvedValue({ reset: true });

      const result = await controller.resetSession(req);

      expect(gameSessionService.forceReset).toHaveBeenCalledWith('player-1');
      expect(result).toEqual({ reset: true });
    });
  });

  describe('events (SSE)', () => {
    it('returns the observable stream for the given session', () => {
      const mockObservable = {};
      sseService.getStream.mockReturnValue(mockObservable);

      const result = controller.events('session-1');

      expect(sseService.getStream).toHaveBeenCalledWith('game-session:session-1');
      expect(result).toBe(mockObservable);
    });
  });
});

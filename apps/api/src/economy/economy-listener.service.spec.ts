import { EconomyListenerService } from './economy-listener.service';

describe('EconomyListenerService', () => {
  const sessionService = {
    endCombat: jest.fn(),
  };

  const perfLogger = {
    logEvent: jest.fn(),
  };

  let service: EconomyListenerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EconomyListenerService(sessionService as any, perfLogger as any);
  });

  describe('handleCombatEnded', () => {
    it('logs the event and delegates to sessionService.endCombat when both IDs are present', async () => {
      const payload = { sessionId: 'session-1', winnerId: 'player-1', loserId: 'player-2' };
      sessionService.endCombat.mockResolvedValue(undefined);

      await service.handleCombatEnded(payload);

      expect(perfLogger.logEvent).toHaveBeenCalledWith('economy', 'combat_ended.received', {
        session_id: 'session-1',
        winner_id: 'player-1',
        loser_id: 'player-2',
      });
      expect(sessionService.endCombat).toHaveBeenCalledWith('session-1', 'player-1', 'player-2');
    });

    it('skips sessionService.endCombat when winnerId is missing', async () => {
      const payload = { sessionId: 'session-1', winnerId: '', loserId: 'player-2' };

      await service.handleCombatEnded(payload);

      expect(sessionService.endCombat).not.toHaveBeenCalled();
    });

    it('skips sessionService.endCombat when loserId is missing', async () => {
      const payload = { sessionId: 'session-1', winnerId: 'player-1', loserId: '' };

      await service.handleCombatEnded(payload);

      expect(sessionService.endCombat).not.toHaveBeenCalled();
    });

    it('still logs even when one ID is missing', async () => {
      const payload = { sessionId: 'session-1', winnerId: 'player-1', loserId: '' };

      await service.handleCombatEnded(payload);

      expect(perfLogger.logEvent).toHaveBeenCalledWith(
        'economy',
        'combat_ended.received',
        expect.any(Object),
      );
    });
  });

  describe('handleCombatPlayerDied', () => {
    it('logs the player death event without side effects', () => {
      const payload = { sessionId: 'session-1', playerId: 'player-2' };

      service.handleCombatPlayerDied(payload);

      expect(perfLogger.logEvent).toHaveBeenCalledWith('economy', 'combat_player_died.received', {
        session_id: 'session-1',
        player_id: 'player-2',
      });
    });

    it('does not call sessionService for player death events', () => {
      service.handleCombatPlayerDied({ sessionId: 'session-1', playerId: 'player-2' });

      expect(sessionService.endCombat).not.toHaveBeenCalled();
    });
  });
});

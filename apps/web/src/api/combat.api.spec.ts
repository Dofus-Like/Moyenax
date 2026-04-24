import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatActionType } from '@game/shared-types';

vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { combatApi } from './combat.api';
import { apiClient } from './client';

describe('combatApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getRooms GET /combat/rooms', () => {
    combatApi.getRooms();
    expect(apiClient.get).toHaveBeenCalledWith('/combat/rooms');
  });

  it('createRoom POST /combat/challenge', () => {
    combatApi.createRoom();
    expect(apiClient.post).toHaveBeenCalledWith('/combat/challenge');
  });

  it('challengePlayer POST /combat/challenge/:targetId', () => {
    combatApi.challengePlayer('target-123');
    expect(apiClient.post).toHaveBeenCalledWith('/combat/challenge/target-123');
  });

  it('acceptChallenge POST /combat/accept/:id', () => {
    combatApi.acceptChallenge('sess-1');
    expect(apiClient.post).toHaveBeenCalledWith('/combat/accept/sess-1');
  });

  it('playAction POST /combat/action/:id avec action', () => {
    const action = { type: CombatActionType.MOVE, targetX: 1, targetY: 2 };
    combatApi.playAction('s-1', action);
    expect(apiClient.post).toHaveBeenCalledWith('/combat/action/s-1', action);
  });

  it('forcePlayAction POST /combat/action/:id/force avec asPlayerId', () => {
    const action = { type: CombatActionType.END_TURN };
    combatApi.forcePlayAction('s-1', 'p1', action);
    expect(apiClient.post).toHaveBeenCalledWith('/combat/action/s-1/force', {
      asPlayerId: 'p1',
      action,
    });
  });

  it('startVsAiCombat POST /combat/vs-ai', () => {
    combatApi.startVsAiCombat();
    expect(apiClient.post).toHaveBeenCalledWith('/combat/vs-ai');
  });

  it('getState GET /combat/session/:id', () => {
    combatApi.getState('s-1');
    expect(apiClient.get).toHaveBeenCalledWith('/combat/session/s-1');
  });

  it('getStreamTicket POST /combat/session/:id/stream-ticket', () => {
    combatApi.getStreamTicket('s-1');
    expect(apiClient.post).toHaveBeenCalledWith('/combat/session/s-1/stream-ticket');
  });

  it('getHistory GET /combat/history', () => {
    combatApi.getHistory();
    expect(apiClient.get).toHaveBeenCalledWith('/combat/history');
  });
});

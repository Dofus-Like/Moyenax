import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEventSourceInstances: MockEventSource[] = [];

class MockEventSource {
  url: string;
  onerror: ((event: unknown) => void) | null = null;
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    mockEventSourceInstances.push(this);
  }

  addEventListener(type: string, callback: (event: MessageEvent) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(callback);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, callback: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(callback);
  }

  close = vi.fn();
}

const mocks = vi.hoisted(() => ({
  combatApi: {
    getState: vi.fn(),
    getStreamTicket: vi.fn(),
    playAction: vi.fn(),
  },
  authStoreState: {
    player: { id: 'player-1' },
  },
}));

vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
vi.stubGlobal('window', {
  confirm: vi.fn(() => true),
  location: { origin: 'http://localhost:5173' },
  clearTimeout,
  setTimeout,
});

vi.mock('../api/combat.api', () => ({
  combatApi: mocks.combatApi,
}));

vi.mock('./auth.store', () => ({
  useAuthStore: Object.assign(
    () => mocks.authStoreState,
    {
      getState: () => mocks.authStoreState,
    },
  ),
}));

import { useCombatStore } from './combat.store';

describe('useCombatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventSourceInstances.length = 0;
    useCombatStore.getState().disconnect();
    mocks.combatApi.getState.mockResolvedValue({
      data: {
        sessionId: 'combat-1',
        currentTurnPlayerId: 'player-1',
        turnNumber: 1,
        players: {},
        map: { width: 10, height: 10, tiles: [] },
      },
    });
    mocks.combatApi.getStreamTicket.mockResolvedValue({
      data: { ticket: 'ticket-1' },
    });
  });

  it('clears all transient combat data on disconnect', () => {
    useCombatStore.setState({
      combatState: { sessionId: 'combat-1' } as any,
      sessionId: 'combat-1',
      selectedSpellId: 'spell-1',
      isSelectingTarget: true,
      logs: [{ id: '1', message: 'old log', type: 'info' }],
      winnerId: 'player-2',
      uiMessage: { id: 'ui-1', text: 'oops', type: 'error' },
    });

    useCombatStore.getState().disconnect();

    expect(useCombatStore.getState()).toMatchObject({
      combatState: null,
      sessionId: null,
      selectedSpellId: null,
      isSelectingTarget: false,
      logs: [],
      winnerId: null,
      uiMessage: null,
    });
  });

  it('resets winner and logs before connecting to a new combat session', async () => {
    useCombatStore.setState({
      sessionId: 'old-combat',
      logs: [{ id: '1', message: 'old', type: 'info' }],
      winnerId: 'player-2',
      uiMessage: { id: 'ui-1', text: 'stale', type: 'error' },
    });

    await useCombatStore.getState().connectToSession('combat-2');

    const state = useCombatStore.getState();
    expect(state.sessionId).toBe('combat-2');
    expect(state.winnerId).toBe(null);
    expect(state.logs[0]?.message).toBe('Combat initialise');
    expect(state.uiMessage).toBe(null);
  });

  it('stores the latest combat state and winner without leaking the previous one', () => {
    useCombatStore.setState({
      winnerId: 'old-winner',
    });

    useCombatStore.getState().setCombatState({
      sessionId: 'combat-9',
      winnerId: 'player-1',
      currentTurnPlayerId: 'player-1',
      turnNumber: 8,
      players: {},
      map: { width: 10, height: 10, tiles: [] },
    } as any);

    expect(useCombatStore.getState().winnerId).toBe('player-1');
    expect(useCombatStore.getState().combatState?.sessionId).toBe('combat-9');
  });
  it('clears logs when clearLogs is called', () => {
    useCombatStore.setState({
      logs: [{ id: '1', message: 'test log', type: 'info' }],
    });

    useCombatStore.getState().clearLogs();

    expect(useCombatStore.getState().logs).toEqual([]);
  });
});

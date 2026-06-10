import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GameSessionProvider } from './GameTunnel';

type GameSessionFixture = {
  id: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  phase: 'FARMING' | 'FIGHTING';
  currentRound: number;
  player1Wins: number;
  player2Wins: number;
  player1Ready: boolean;
  player2Ready: boolean;
  player1Id: string;
  player2Id: string | null;
  gold: number;
  player1Po: number;
  player2Po: number;
  combats: Array<{
    id: string;
    status: 'WAITING' | 'ACTIVE' | 'FINISHED';
    createdAt: string;
    winnerId?: string | null;
  }>;
};

const mocks = vi.hoisted(() => {
  const authState = { token: 'token-1' };

  return {
    authState,
    disconnectCombat: vi.fn(),
    gameSessionApi: {
      getActiveSession: vi.fn(),
      getStreamTicket: vi.fn(),
    },
    resetFarming: vi.fn(),
  };
});

vi.mock('../api/game-session.api', () => ({
  gameSessionApi: mocks.gameSessionApi,
}));

vi.mock('../store/auth.store', () => ({
  useAuthStore: Object.assign(
    (selector?: (state: typeof mocks.authState) => unknown) =>
      selector ? selector(mocks.authState) : mocks.authState,
    { getState: () => mocks.authState },
  ),
}));

vi.mock('../store/combat.store', () => ({
  useCombatStore: {
    getState: () => ({
      disconnect: mocks.disconnectCombat,
    }),
  },
}));

vi.mock('../store/farming.store', () => ({
  useFarmingStore: {
    getState: () => ({
      reset: mocks.resetFarming,
    }),
  },
}));

vi.mock('../store/language.store', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

class EventSourceMock {
  static instances: EventSourceMock[] = [];

  onerror: ((event: Event) => void) | null = null;
  private readonly listeners = new Map<string, (event: MessageEvent) => void>();

  constructor(public readonly url: string) {
    EventSourceMock.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string): void {
    this.listeners.delete(type);
  }

  close(): void {
    return undefined;
  }

  emit(type: string, data: unknown): void {
    this.listeners.get(type)?.(
      new MessageEvent(type, {
        data: JSON.stringify(data),
      }),
    );
  }
}

function createSession(overrides: Partial<GameSessionFixture> = {}): GameSessionFixture {
  return {
    id: 'session-1',
    status: 'ACTIVE',
    phase: 'FARMING',
    currentRound: 1,
    player1Wins: 0,
    player2Wins: 0,
    player1Ready: false,
    player2Ready: false,
    player1Id: 'player-1',
    player2Id: 'player-2',
    gold: 0,
    player1Po: 0,
    player2Po: 0,
    combats: [],
    ...overrides,
  };
}

describe('GameSessionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EventSourceMock.instances = [];
    vi.stubGlobal('EventSource', EventSourceMock);
    mocks.authState.token = 'token-1';
    mocks.gameSessionApi.getActiveSession.mockResolvedValue({ data: createSession() });
    mocks.gameSessionApi.getStreamTicket.mockResolvedValue({
      data: { ticket: 'ticket-1', expiresIn: 60 },
    });
  });

  it('keeps the same session SSE stream when SESSION_UPDATED only changes session data', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/farming']}>
        <GameSessionProvider>
          <div>child</div>
        </GameSessionProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.gameSessionApi.getStreamTicket).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      EventSourceMock.instances[0].emit('SESSION_UPDATED', createSession({ currentRound: 2 }));
    });

    expect(EventSourceMock.instances).toHaveLength(1);
    expect(mocks.gameSessionApi.getStreamTicket).toHaveBeenCalledTimes(1);

    unmount();
  });
});

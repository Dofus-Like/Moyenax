import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  activeSession: null as any,
  gameSessionApi: {
    createPrivateSession: vi.fn(),
    endSession: vi.fn(),
    getActiveSession: vi.fn(),
    getQueueStatus: vi.fn(),
    getWaitingSessions: vi.fn(),
    joinPrivateSession: vi.fn(),
    joinQueue: vi.fn(),
    leaveQueue: vi.fn(),
    startVsAi: vi.fn(),
  },
  initialize: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn(),
  navigate: vi.fn(),
  refreshSession: vi.fn().mockResolvedValue(undefined),
  setSkin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('../store/auth.store', () => ({
  useAuthStore: () => ({
    player: {
      id: 'player-1',
      username: 'roketag',
      skin: 'soldier-classic',
    },
    logout: mocks.logout,
    initialize: mocks.initialize,
    setSkin: mocks.setSkin,
  }),
}));

vi.mock('./GameTunnel', () => ({
  useGameSession: () => ({
    activeSession: mocks.activeSession,
    refreshSession: mocks.refreshSession,
  }),
}));

vi.mock('../api/game-session.api', () => ({
  gameSessionApi: mocks.gameSessionApi,
}));

import { LobbyPage } from './LobbyPage';

describe('LobbyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeSession = null;
    mocks.gameSessionApi.getWaitingSessions.mockResolvedValue({ data: [] });
    mocks.gameSessionApi.getQueueStatus.mockResolvedValue({ data: { queued: false } });
  });

  it('rehydrates an existing waiting room and switches controls to cancel mode', async () => {
    mocks.activeSession = {
      id: 'session-1',
      status: 'WAITING',
      phase: 'FARMING',
      currentRound: 1,
      player1Wins: 0,
      player2Wins: 0,
      player1Ready: false,
      player2Ready: false,
      player1Id: 'player-1',
      player2Id: null,
      gold: 0,
      player1Po: 0,
      player2Po: 0,
      combats: [],
    };

    render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByRole('button', { name: 'Annuler la room' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Lancer une recherche' })).not.toBeInTheDocument();
  });

  it('restores the random queue state after refresh when no open session exists', async () => {
    mocks.gameSessionApi.getQueueStatus.mockResolvedValue({ data: { queued: true } });

    render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Recherche d'un adversaire...")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });
});

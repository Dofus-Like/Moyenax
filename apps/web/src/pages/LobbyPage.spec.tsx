import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('does not render shortcut cards for farming, inventory, shop or debug', async () => {
    render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Lancer une recherche' });

    expect(screen.queryByText('Récoltez des ressources')).not.toBeInTheDocument();
    expect(screen.queryByText('Gérez votre équipement')).not.toBeInTheDocument();
    expect(screen.queryByText('Achetez des équipements')).not.toBeInTheDocument();
    expect(screen.queryByText('Tests techniques')).not.toBeInTheDocument();
  });

  it('renders the VS AI action below the rooms section instead of in the header', async () => {
    const { container } = render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Lancer VS AI' })).toBeInTheDocument();

    const header = container.querySelector('.lobby-header') || container.querySelector('.lobby-section-header');
    expect(header?.textContent).not.toContain('VS AI');
  });

  it('navigates to /farming when an active session transitions to ACTIVE status', async () => {
    mocks.activeSession = {
      id: 'session-2',
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
    };

    render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/farming');
    });
  });

  it('joins the random queue and shows the searching state', async () => {
    mocks.gameSessionApi.joinQueue.mockResolvedValue({ data: {} });

    render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    const joinBtn = await screen.findByRole('button', { name: 'Lancer une recherche' });
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(mocks.gameSessionApi.joinQueue).toHaveBeenCalledWith();
    });
  });

  it('creates a private room and shows the cancel button', async () => {
    mocks.gameSessionApi.createPrivateSession.mockResolvedValue({ data: { id: 'new-session' } });
    mocks.refreshSession.mockImplementation(async () => {
      mocks.activeSession = {
        id: 'new-session',
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
    });

    render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    const createBtn = await screen.findByRole('button', { name: 'Créer une room' });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mocks.gameSessionApi.createPrivateSession).toHaveBeenCalled();
    });
  });

  it('shows waiting rooms returned by the API', async () => {
    mocks.gameSessionApi.getWaitingSessions.mockResolvedValue({
      data: [
        {
          id: 'room-1',
          player1Id: 'other-player',
          player2Id: null,
          status: 'WAITING',
          createdAt: new Date().toISOString(),
          p1: { username: 'Alice' },
        },
      ],
    });

    render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('starts a VS AI game when the button is clicked', async () => {
    mocks.gameSessionApi.startVsAi.mockResolvedValue({ data: { id: 'ai-session' } });

    render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>,
    );

    const vsAiBtn = await screen.findByRole('button', { name: 'Lancer VS AI' });
    fireEvent.click(vsAiBtn);

    await waitFor(() => {
      expect(mocks.gameSessionApi.startVsAi).toHaveBeenCalled();
    });
  });
});

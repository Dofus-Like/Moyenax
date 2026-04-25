import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  refreshPlayer: vi.fn().mockResolvedValue(undefined),
  refreshSession: vi.fn().mockResolvedValue(undefined),
  farmingState: {
    map: {
      width: 2,
      height: 2,
      seedId: 'FORGE',
      grid: [
        ['GROUND', 'GROUND'],
        ['HERB', 'GROUND'],
      ],
    },
    playerPosition: { x: 0, y: 0 },
    movePlayer: vi.fn(),
    inventory: {},
    fetchState: vi.fn().mockResolvedValue(undefined),
    gatherNode: vi.fn().mockResolvedValue({
      pips: 3,
      round: 1,
      spendableGold: 2,
    }),
    debugRefill: vi.fn().mockResolvedValue(undefined),
    nextRound: vi.fn(),
    round: 1,
    pips: 4,
    spendableGold: 2,
  },
  activeSession: null as any,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="canvas">{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
  CameraControls: () => null,
  OrthographicCamera: () => null,
}));

vi.mock('camera-controls', () => ({
  default: {
    ACTION: {
      NONE: 0,
      TRUCK: 1,
    },
  },
}));

vi.mock('../game/UnifiedMap/UnifiedMapScene', () => ({
  UnifiedMapScene: ({ onTileClick }: { onTileClick?: (x: number, y: number, terrain: any) => void }) => (
    <div data-testid="map-scene">
      <button type="button" onClick={() => onTileClick?.(0, 1, 'HERB')}>
        Harvest tile
      </button>
    </div>
  ),
}));

vi.mock('../game/UnifiedMap/hooks/useAutoHarvest', () => ({
  useAutoHarvest: () => undefined,
}));

vi.mock('../api/game-session.api', () => ({
  gameSessionApi: {
    endSession: vi.fn(),
    toggleReady: vi.fn(),
  },
}));

vi.mock('../store/auth.store', () => ({
  useAuthStore: (selector?: (state: any) => unknown) => {
    const state = {
      player: { id: 'player-1' },
      refreshPlayer: mocks.refreshPlayer,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('./GameTunnel', () => ({
  useGameSession: () => ({
    activeSession: mocks.activeSession,
    refreshSession: mocks.refreshSession,
  }),
}));

vi.mock('../store/farming.store', () => {
  const hook = (selector?: (state: any) => unknown) => (selector ? selector(mocks.farmingState) : mocks.farmingState);
  return {
    useFarmingStore: Object.assign(hook, {
      getState: () => mocks.farmingState,
    }),
  };
});

import { FarmingPage } from './FarmingPage';

describe('FarmingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeSession = null;
    mocks.farmingState.round = 1;
    mocks.farmingState.pips = 4;
    mocks.farmingState.spendableGold = 2;
    mocks.farmingState.map = {
      width: 2,
      height: 2,
      seedId: 'FORGE',
      grid: [
        ['GROUND', 'GROUND'],
        ['HERB', 'GROUND'],
      ],
    };
    mocks.farmingState.playerPosition = { x: 0, y: 0 };
    mocks.farmingState.gatherNode.mockResolvedValue({
      pips: 3,
      round: 1,
      spendableGold: 2,
    });
  });

  it('does not render the end round button in normal game flow', async () => {
    render(
      <MemoryRouter initialEntries={['/farming']}>
        <FarmingPage />
      </MemoryRouter>,
    );

    await screen.findByText('Récoltes');
    expect(screen.queryByRole('button', { name: 'Terminer la manche' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Debug refill' })).not.toBeInTheDocument();
  });

  it('does not auto-advance when the page loads with no pips remaining', async () => {
    mocks.farmingState.pips = 0;

    render(
      <MemoryRouter initialEntries={['/farming']}>
        <FarmingPage />
      </MemoryRouter>,
    );

    await screen.findByText('Récoltes');
    await waitFor(() => expect(mocks.navigate).not.toHaveBeenCalled());
  });

  it('navigates to crafting once after the last successful harvest', async () => {
    mocks.farmingState.gatherNode.mockImplementation(async () => {
      mocks.farmingState.pips = 0;
      return {
        pips: 0,
        round: 1,
        spendableGold: 2,
      };
    });

    render(
      <MemoryRouter initialEntries={['/farming']}>
        <FarmingPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Harvest tile' }));

    await waitFor(() => {
      expect(mocks.farmingState.gatherNode).toHaveBeenCalledWith(0, 1);
      expect(mocks.navigate).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).toHaveBeenCalledWith('/crafting');
    });
  });

  it('shows inventory resource names from the farming store', async () => {
    mocks.farmingState.inventory = { Bois: 3 };

    render(
      <MemoryRouter initialEntries={['/farming']}>
        <FarmingPage />
      </MemoryRouter>,
    );

    await screen.findByText('Récoltes');
    // "Bois" appears in the inventory list AND the legend — verify it shows up at least once
    expect(screen.getAllByText('Bois').length).toBeGreaterThan(0);
    // The inventory count should be visible
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls fetchState on mount to hydrate the map', async () => {
    render(
      <MemoryRouter initialEntries={['/farming']}>
        <FarmingPage />
      </MemoryRouter>,
    );

    await screen.findByText('Récoltes');
    expect(mocks.farmingState.fetchState).toHaveBeenCalled();
  });

  it('shows pips remaining text from the store', async () => {
    mocks.farmingState.pips = 2;

    render(
      <MemoryRouter initialEntries={['/farming']}>
        <FarmingPage />
      </MemoryRouter>,
    );

    await screen.findByText('Récoltes');
    expect(screen.getByText('2 / 4 récoltes')).toBeInTheDocument();
  });

  it('shows "Aucune ressource" when inventory is empty', async () => {
    mocks.farmingState.inventory = {};

    render(
      <MemoryRouter initialEntries={['/farming']}>
        <FarmingPage />
      </MemoryRouter>,
    );

    await screen.findByText('Récoltes');
    expect(screen.getByText('Aucune ressource récoltée.')).toBeInTheDocument();
  });
});

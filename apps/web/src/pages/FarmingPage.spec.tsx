import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  useThree: () => ({ camera: {} }),
  useLoader: () => ({
    repeat: { set: vi.fn() },
    offset: { set: vi.fn() },
    center: { set: vi.fn() },
  }),
  useFrame: vi.fn(),
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

vi.mock('../api/inventory.api', () => ({
  inventoryApi: { getInventory: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../api/player.api', () => ({
  playerApi: { getSpells: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../api/equipment.api', () => ({
  equipmentApi: {
    getEquipment: vi.fn().mockResolvedValue({ data: [] }),
    equip: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../api/shop.api', () => ({
  shopApi: { getItems: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../api/crafting.api', () => ({
  craftingApi: { craft: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock('../store/auth.store', () => {
  const state = {
    player: { id: 'player-1' },
    token: 'fake-token',
    refreshPlayer: mocks.refreshPlayer,
    logout: vi.fn(),
  };
  const hook = (selector?: (state: any) => unknown) => (selector ? selector(state) : state);
  return {
    useAuthStore: Object.assign(hook, {
      getState: () => state,
    }),
  };
});

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

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
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/farming']}>
          <FarmingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(/ROUND/i);
    expect(screen.queryByRole('button', { name: 'Terminer la manche' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Debug refill' })).not.toBeInTheDocument();
  });

  it('does not auto-advance when the page loads with no pips remaining', async () => {
    mocks.farmingState.pips = 0;

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/farming']}>
          <FarmingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(/ROUND/i);
    await waitFor(() => expect(mocks.navigate).not.toHaveBeenCalled());
  });

  it('does NOT navigate after the last successful harvest', async () => {
    mocks.farmingState.gatherNode.mockImplementation(async () => {
      mocks.farmingState.pips = 0;
      return {
        pips: 0,
        round: 1,
        spendableGold: 2,
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/farming']}>
          <FarmingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Harvest tile' }));

    await waitFor(() => {
      expect(mocks.farmingState.gatherNode).toHaveBeenCalledWith(0, 1);
      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  });
});

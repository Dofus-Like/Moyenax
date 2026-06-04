import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React, { type ReactNode } from 'react';
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
    harvestedTiles: new Set<string>(),
  },
  shopApi: {
    getItems: vi.fn().mockResolvedValue({ data: [] }),
    buyItem: vi.fn().mockResolvedValue({ data: {} }),
  },
  activeSession: null as { id: string; status: string; phase: string } | null,
  latestMapProps: null as { onTileReached?: unknown } | null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
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
  PerspectiveCamera: () => null,
  Sparkles: () => null,
  useProgress: () => ({ active: false, progress: 100 }),
}));

vi.mock('../game/Combat/WaterPlane', () => ({
  WaterPlane: () => null,
}));

vi.mock('../game/Combat/DistantIslands', () => ({
  DistantIslands: () => null,
}));

vi.mock('camera-controls', () => ({
  default: {
    ACTION: {
      NONE: 0,
      TRUCK: 1,
    },
  },
}));

vi.mock('./FarmingMapScene', () => ({
  FarmingMapScene: (props: {
    onTileClick?: (x: number, y: number, terrain: string) => void;
    onTileReached?: unknown;
    onSceneReady?: () => void;
  }) => {
    mocks.latestMapProps = props;
    React.useEffect(() => {
      props.onSceneReady?.();
    }, [props]);

    return (
      <div data-testid="map-scene">
        <button type="button" onClick={() => props.onTileClick?.(0, 1, 'HERB')}>
          Harvest tile
        </button>
      </div>
    );
  },
}));

vi.mock('../game/UnifiedMap/hooks/useAutoHarvest', () => ({
  useAutoHarvest: () => undefined,
}));

vi.mock('../game/Combat/CombatBackgroundShader', () => ({
  CombatBackgroundShader: () => null,
}));

vi.mock('../game/Combat/CameraEffects', () => ({
  CameraEffects: () => null,
}));

vi.mock('../perf/CanvasPerfOverlay', () => ({
  CanvasPerfOverlay: () => null,
}));

vi.mock('../api/game-session.api', () => ({
  gameSessionApi: {
    endSession: vi.fn(),
    toggleReady: vi.fn(),
  },
}));

const mockInventoryApi = vi.hoisted(() => ({
  getInventory: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('../api/inventory.api', () => ({
  inventoryApi: mockInventoryApi,
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
  shopApi: mocks.shopApi,
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
  const hook = (selector?: (state: unknown) => unknown) => (selector ? selector(mocks.farmingState) : mocks.farmingState);
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

function renderFarmingPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/farming']}>
        <FarmingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FarmingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInventoryApi.getInventory.mockResolvedValue({ data: [] });
    queryClient.clear();
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
    mocks.latestMapProps = null;
    mocks.farmingState.gatherNode.mockResolvedValue({
      pips: 3,
      round: 1,
      spendableGold: 2,
    });
    mocks.shopApi.getItems.mockResolvedValue({ data: [] });
    mocks.shopApi.buyItem.mockResolvedValue({ data: {} });
  });

  it('does not update the farming position on intermediate path tiles', async () => {
    renderFarmingPage();

    await screen.findByTestId('map-scene');

    // onTileReached est branché (sons de pas) mais ne doit jamais déplacer le joueur :
    // la position n'est mise à jour qu'à la fin du chemin (onPathComplete).
    mocks.farmingState.movePlayer.mockClear();
    (mocks.latestMapProps?.onTileReached as ((node: { x: number; y: number }) => void) | undefined)?.({
      x: 1,
      y: 0,
    });

    expect(mocks.farmingState.movePlayer).not.toHaveBeenCalled();
  });

  it('does not render the end round button in normal game flow', async () => {
    renderFarmingPage();

    await screen.findByText(/ROUND/i);
    expect(screen.queryByRole('button', { name: 'Terminer la manche' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Debug refill' })).not.toBeInTheDocument();
  });

  it('does not auto-advance when the page loads with no pips remaining', async () => {
    mocks.farmingState.pips = 0;

    renderFarmingPage();

    await screen.findByText(/ROUND/i);
    await waitFor(() => expect(mocks.navigate).not.toHaveBeenCalled());
  });

  it('spawns the player near the center of the resource map on page load', async () => {
    mocks.farmingState.playerPosition = { x: 0, y: 0 };

    renderFarmingPage();

    await waitFor(() => {
      expect(mocks.farmingState.movePlayer).toHaveBeenCalledWith({ x: 1, y: 1 });
    });
  });

  it('does not harvest an already-harvested tile', async () => {
    mocks.farmingState.harvestedTiles = new Set(['0,1']);

    renderFarmingPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Harvest tile' }));

    await waitFor(() => {
      expect(mocks.farmingState.gatherNode).not.toHaveBeenCalled();
    });
  });

  it('harvests a non-harvested tile', async () => {
    mocks.farmingState.harvestedTiles = new Set([]);

    renderFarmingPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Harvest tile' }));

    await waitFor(() => {
      expect(mocks.farmingState.gatherNode).toHaveBeenCalledWith(0, 1);
    });
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

    renderFarmingPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Harvest tile' }));

    await waitFor(() => {
      expect(mocks.farmingState.gatherNode).toHaveBeenCalledWith(0, 1);
      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  });

  it('shows inventory resource names from the farming store', async () => {
    mockInventoryApi.getInventory.mockResolvedValue({
      data: [{ id: 'inv-1', quantity: 3, item: { name: 'Bois', type: 'RESOURCE', iconPath: '/icons/wood.png' } }],
    });

    renderFarmingPage();

    expect(await screen.findByAltText('Bois')).toBeInTheDocument();
    expect(screen.getByText('x3')).toBeInTheDocument();
  });

  it('calls fetchState on mount to hydrate the map', async () => {
    renderFarmingPage();

    await waitFor(() => expect(mocks.farmingState.fetchState).toHaveBeenCalled());
  });

  it('shows pips remaining text from the store', async () => {
    mocks.farmingState.pips = 2;

    const { container } = renderFarmingPage();

    await waitFor(() => {
      expect(container.querySelectorAll('.pip-diamond.filled')).toHaveLength(2);
    });
  });

  it('shows "Aucune ressource" when inventory is empty', async () => {
    mocks.farmingState.inventory = {};

    const { container } = renderFarmingPage();

    await waitFor(() => {
      expect(container.querySelectorAll('.res-counter')).toHaveLength(0);
    });
  });

  it('refreshes farming state and session after buying from the embedded shop', async () => {
    mocks.shopApi.getItems.mockResolvedValue({
      data: [{
        id: 'item-1',
        name: 'Épée test',
        type: 'WEAPON',
        shopPrice: 1,
        iconPath: '/sword.png',
      }],
    });

    renderFarmingPage();

    fireEvent.click(await screen.findByRole('button', { name: /Boutique/i }));
    fireEvent.doubleClick(await screen.findByAltText('Épée test'));

    await waitFor(() => {
      expect(mocks.shopApi.buyItem).toHaveBeenCalledWith({ itemId: 'item-1', quantity: 1 });
      expect(mocks.farmingState.fetchState).toHaveBeenCalledTimes(2);
      expect(mocks.refreshPlayer).toHaveBeenCalled();
      expect(mocks.refreshSession).toHaveBeenCalledWith({ silent: true });
    });
  });
});

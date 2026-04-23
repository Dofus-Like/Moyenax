import type { ReactNode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  activeSession: null as any,
  refreshSession: vi.fn().mockResolvedValue(undefined),
  combatState: {
    sessionId: 'combat-1',
    turnNumber: 1,
    currentTurnPlayerId: 'player-1',
    players: {},
    map: {
      width: 1,
      height: 1,
      tiles: [{ x: 0, y: 0, type: 'GROUND' }],
    },
  },
  winnerId: null as string | null,
  connectToSession: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  setSelectedSpell: vi.fn(),
  logs: [],
  initialize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ sessionId: 'combat-1' }),
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="canvas">{children}</div>,
  useLoader: vi.fn(),
  useThree: () => ({
    viewport: { width: 100, height: 100 },
    camera: {
      position: new THREE.Vector3(),
      getWorldDirection: vi.fn().mockReturnValue(new THREE.Vector3()),
    },
  }),
  useFrame: vi.fn(),
}));

vi.mock('leva', () => ({
  useControls: (name: string, controls: any) => {
    const values: any = {};
    for (const key in controls) {
      if (controls[key] && typeof controls[key] === 'object' && 'value' in controls[key]) {
        values[key] = controls[key].value;
      } else {
        values[key] = controls[key];
      }
    }
    return values;
  },
}));

vi.mock('../game/Combat/CombatBackgroundShader', () => ({
  CombatBackgroundShader: () => <div data-testid="combat-background-shader" />,
}));

vi.mock('@react-three/drei', () => ({
  OrthographicCamera: () => null,
  CameraControls: () => null,
  Text: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('camera-controls', () => ({
  default: {
    ACTION: {
      NONE: 0,
      TRUCK: 1,
      DOLLY: 2,
    },
  },
}));

vi.mock('../game/UnifiedMap/UnifiedMapScene', () => ({
  UnifiedMapScene: () => <div data-testid="combat-map" />,
}));

vi.mock('../game/HUD/CombatHUD', () => ({
  CombatHUD: () => <div data-testid="combat-hud" />,
}));

vi.mock('../store/combat.store', () => ({
  useCombatStore: (selector?: (state: any) => unknown) => {
    const state = {
      combatState: mocks.combatState,
      winnerId: mocks.winnerId,
      connectToSession: mocks.connectToSession,
      disconnect: mocks.disconnect,
      setSelectedSpell: mocks.setSelectedSpell,
      logs: mocks.logs,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../store/auth.store', () => ({
  useAuthStore: (selector?: (state: any) => unknown) => {
    const state = {
      initialize: mocks.initialize,
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

vi.mock('../api/game-session.api', () => ({
  gameSessionApi: {
    endSession: vi.fn(),
  },
}));

import { CombatPage } from './CombatPage';

describe('CombatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeSession = null;
    mocks.winnerId = null;
  });

  it('redirects to the lobby when a linked game session disappears', async () => {
    mocks.activeSession = {
      id: 'game-session-1',
      status: 'ACTIVE',
      phase: 'FIGHTING',
      combats: [],
    };

    const { rerender } = render(<CombatPage />);

    await waitFor(() => {
      expect(mocks.connectToSession).toHaveBeenCalledWith('combat-1');
    });

    mocks.activeSession = null;
    rerender(<CombatPage />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('does not redirect standalone combats when no game session was ever linked', async () => {
    render(<CombatPage />);

    await waitFor(() => {
      expect(mocks.connectToSession).toHaveBeenCalledWith('combat-1');
    });

    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

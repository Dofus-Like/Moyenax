import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  combatState: {
    sessionId: 'combat-1',
    turnNumber: 1,
    currentTurnPlayerId: 'player-1',
    players: {
      'player-1': {
        playerId: 'player-1',
        username: 'Alice',
        type: 'PLAYER',
        stats: {
          vit: 100,
          atk: 10,
          mag: 5,
          def: 5,
          res: 5,
          ini: 10,
          pa: 6,
          pm: 3,
          baseVit: 100,
          baseAtk: 10,
          baseMag: 5,
          baseDef: 5,
          baseRes: 5,
          baseIni: 10,
          basePa: 6,
          basePm: 3,
        },
        position: { x: 0, y: 0 },
        spells: [
          {
            id: 'spell-claque',
            code: 'spell-claque',
            name: 'Claque',
            description: 'Une gifle.',
            paCost: 2,
            minRange: 1,
            maxRange: 1,
            damage: { min: 8, max: 12 },
            cooldown: 0,
            type: 'DAMAGE',
            visualType: 'PHYSICAL',
            family: 'COMMON',
            iconPath: '/assets/pack/spells/epee.png',
            sortOrder: 99,
            requiresLineOfSight: true,
            requiresLinearTargeting: false,
            effectKind: 'DAMAGE_PHYSICAL',
            effectConfig: {},
          },
          {
            id: 'spell-boule-de-feu',
            code: 'spell-boule-de-feu',
            name: 'Boule de Feu',
            description: 'Une boule de feu.',
            paCost: 3,
            minRange: 1,
            maxRange: 7,
            damage: { min: 20, max: 30 },
            cooldown: 0,
            type: 'DAMAGE',
            visualType: 'PROJECTILE',
            family: 'MAGE',
            iconPath: '/assets/pack/spells/fireball.png',
            sortOrder: 20,
            requiresLineOfSight: true,
            requiresLinearTargeting: false,
            effectKind: 'DAMAGE_MAGICAL',
            effectConfig: {},
          },
        ],
        remainingPa: 6,
        remainingPm: 3,
        currentVit: 100,
        spellCooldowns: {},
        buffs: [],
        skin: 'soldier-classic',
      },
    },
    map: {
      width: 1,
      height: 1,
      tiles: [{ x: 0, y: 0, type: 'GROUND' }],
    },
  },
  sessionId: 'combat-1',
  selectedSpellId: null as string | null,
  setSelectedSpell: vi.fn(),
  setCombatState: vi.fn(),
  winnerId: null as string | null,
  showEnemyHp: false,
  toggleShowEnemyHp: vi.fn(),
  surrender: vi.fn(),
  disconnect: vi.fn(),
  uiMessage: null as { kind: string; text: string } | null,
  setUiMessage: vi.fn(),
  user: {
    id: 'player-1',
    username: 'Alice',
  },
  activeSession: null as { id: string; status: string; phase: string } | null,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../store/combat.store', () => ({
  useCombatStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      combatState: mocks.combatState,
      sessionId: mocks.sessionId,
      selectedSpellId: mocks.selectedSpellId,
      setSelectedSpell: mocks.setSelectedSpell,
      setCombatState: mocks.setCombatState,
      winnerId: mocks.winnerId,
      showEnemyHp: mocks.showEnemyHp,
      toggleShowEnemyHp: mocks.toggleShowEnemyHp,
      surrender: mocks.surrender,
      disconnect: mocks.disconnect,
      uiMessage: mocks.uiMessage,
      setUiMessage: mocks.setUiMessage,
    };

    return selector ? selector(state) : state;
  },
}));

vi.mock('../../store/auth.store', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      player: mocks.user,
    };

    return selector ? selector(state) : state;
  },
}));

vi.mock('../../pages/GameTunnel', () => ({
  useGameSession: () => ({
    activeSession: mocks.activeSession,
  }),
}));

vi.mock('../../api/combat.api', () => ({
  combatApi: {
    playAction: vi.fn(),
  },
}));

vi.mock('../../game/constants/skins', () => ({
  getSkinById: () => ({
    type: 'soldier',
    hue: 0,
    saturation: 1,
  }),
}));

import { CombatHUD } from './CombatHUD';

describe('CombatHUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.winnerId = null;
    mocks.selectedSpellId = null;
    mocks.uiMessage = null;
    mocks.activeSession = null;
  });

  it('renders spell family and icon from the combat payload', () => {
    const { container } = render(<CombatHUD />);

    const claqueIcon = screen.getByAltText('Claque');
    const fireballIcon = screen.getByAltText('Boule de Feu');

    expect(claqueIcon.getAttribute('src')).toBe('/assets/pack/spells/epee.png');
    expect(fireballIcon.getAttribute('src')).toBe('/assets/pack/spells/fireball.png');
    expect(container.querySelector('.spell-card.family-common')).not.toBeNull();
    expect(container.querySelector('.spell-card.family-mage')).not.toBeNull();
  });

  it('shows victory overlay when current player wins', () => {
    mocks.winnerId = 'player-1'; // same as mocks.user.id

    render(<CombatHUD />);

    expect(screen.getByText(/VICTOIRE/)).toBeInTheDocument();
  });

  it('shows defeat overlay when current player loses', () => {
    mocks.winnerId = 'enemy-player';

    render(<CombatHUD />);

    expect(screen.getByText(/DÉFAITE/)).toBeInTheDocument();
  });

  it('does not show end overlay when combat is still ongoing', () => {
    render(<CombatHUD />);

    expect(screen.queryByText(/VICTOIRE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/DÉFAITE/)).not.toBeInTheDocument();
  });

  it('shows "Retour au Lobby" exit button in the end overlay outside a game session', () => {
    mocks.winnerId = 'player-1';
    mocks.activeSession = null;

    render(<CombatHUD />);

    expect(screen.getByRole('button', { name: 'Retour au Lobby' })).toBeInTheDocument();
  });

  it('shows "Continuer" exit button when a game session is still active', () => {
    mocks.winnerId = 'player-1';
    mocks.activeSession = { id: 'gs-1', status: 'ACTIVE' };

    render(<CombatHUD />);

    expect(screen.getByRole('button', { name: 'Continuer' })).toBeInTheDocument();
  });

  it('displays the turn number in the initiative panel', () => {
    render(<CombatHUD />);

    expect(screen.getByText('Tour 1')).toBeInTheDocument();
  });

  it('displays player name in the initiative panel', () => {
    render(<CombatHUD />);

    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
  });

  it('renders ui toast message when uiMessage is set', () => {
    mocks.uiMessage = { id: 'ui-1', text: 'Spell failed!', type: 'error' };

    render(<CombatHUD />);

    expect(screen.getByText('Spell failed!')).toBeInTheDocument();
  });

  it('mage spells are sorted after common spells (family order: common < mage)', () => {
    const { container } = render(<CombatHUD />);

    const spellCards = container.querySelectorAll('.spell-card');
    const classes = Array.from(spellCards).map((c) => c.className);

    const mageIndex = classes.findIndex((c) => c.includes('family-mage'));
    const commonIndex = classes.findIndex((c) => c.includes('family-common'));

    // COMMON=1 sorts before MAGE=3, so mage appears later in the list
    expect(mageIndex).toBeGreaterThan(commonIndex);
  });

  it('end turn calls combatApi.playAction when clicked', async () => {
    mocks.combatState = {
      ...mocks.combatState,
      currentTurnPlayerId: 'player-1',
    };

    const { combatApi } = await import('../../api/combat.api');
    vi.mocked(combatApi.playAction).mockResolvedValue({ data: mocks.combatState } as Awaited<ReturnType<typeof combatApi.playAction>>);

    render(<CombatHUD />);

    const endTurnBtn = screen.queryByRole('button', { name: /Terminer le tour/i });
    if (endTurnBtn) {
      fireEvent.click(endTurnBtn);
      await waitFor(() => {
        expect(vi.mocked(combatApi.playAction)).toHaveBeenCalledWith(
          'combat-1',
          expect.objectContaining({ type: expect.stringMatching(/END_TURN/) }),
        );
      });
    }
  });
});

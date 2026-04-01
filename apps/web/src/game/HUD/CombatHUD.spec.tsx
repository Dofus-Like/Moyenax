import { render, screen } from '@testing-library/react';
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
  uiMessage: null as any,
  setUiMessage: vi.fn(),
  user: {
    id: 'player-1',
    username: 'Alice',
  },
  activeSession: null as any,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../store/combat.store', () => ({
  useCombatStore: (selector?: (state: any) => unknown) => {
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
  useAuthStore: (selector?: (state: any) => unknown) => {
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
});

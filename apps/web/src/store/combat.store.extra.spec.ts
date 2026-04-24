import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests additionnels pour combat.store ciblant les parties non couvertes
 * par combat.store.spec.ts (toggles, addLog, setUiMessage, setSelectedSpell, setCombatState).
 */

const mockEventSourceInstances: Array<{
  close: () => void;
  addEventListener: (type: string, cb: (e: unknown) => void) => void;
  removeEventListener: () => void;
}> = [];

class MockEventSource {
  close = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  constructor(public url: string) {
    mockEventSourceInstances.push(this as unknown as (typeof mockEventSourceInstances)[number]);
  }
}

const mocks = vi.hoisted(() => ({
  combatApi: {
    getState: vi.fn(),
    getStreamTicket: vi.fn(),
    playAction: vi.fn(),
  },
  authStoreState: { player: { id: 'player-1' } },
}));

vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
vi.stubGlobal('window', {
  confirm: vi.fn(() => true),
  location: { origin: 'http://localhost:5173' },
  clearTimeout,
  setTimeout,
});

vi.mock('../api/combat.api', () => ({ combatApi: mocks.combatApi }));
vi.mock('./auth.store', () => ({
  useAuthStore: Object.assign(() => mocks.authStoreState, {
    getState: () => mocks.authStoreState,
  }),
}));

import { useCombatStore } from './combat.store';
import type { CombatState } from '@game/shared-types';

const fakeCombatState: CombatState = {
  sessionId: 's',
  currentTurnPlayerId: 'player-1',
  turnNumber: 1,
  players: {},
  map: { width: 10, height: 10, tiles: [] },
};

describe('combat.store - accessors/toggles/utils', () => {
  beforeEach(() => {
    useCombatStore.getState().disconnect();
    vi.clearAllMocks();
  });

  describe('toggleShowEnemyHp / toggleShowMannequins', () => {
    it('toggleShowEnemyHp bascule la valeur', () => {
      const before = useCombatStore.getState().showEnemyHp;
      useCombatStore.getState().toggleShowEnemyHp();
      expect(useCombatStore.getState().showEnemyHp).toBe(!before);
    });

    it('toggleShowMannequins bascule la valeur', () => {
      const before = useCombatStore.getState().showMannequins;
      useCombatStore.getState().toggleShowMannequins();
      expect(useCombatStore.getState().showMannequins).toBe(!before);
    });
  });

  describe('setCombatState', () => {
    it('met à jour state et winnerId depuis state.winnerId', () => {
      useCombatStore.getState().setCombatState({
        ...fakeCombatState,
        winnerId: 'winner-p',
      });
      expect(useCombatStore.getState().winnerId).toBe('winner-p');
      expect(useCombatStore.getState().combatState?.sessionId).toBe('s');
    });

    it('winnerId à null si state.winnerId absent', () => {
      useCombatStore.setState({ winnerId: 'old-w' });
      useCombatStore.getState().setCombatState(fakeCombatState);
      expect(useCombatStore.getState().winnerId).toBeNull();
    });

    it('crée une nouvelle ref (shallow clone) pour forcer re-render', () => {
      useCombatStore.getState().setCombatState(fakeCombatState);
      const stored = useCombatStore.getState().combatState;
      expect(stored).not.toBe(fakeCombatState);
      expect(stored).toEqual(fakeCombatState);
    });
  });

  describe('setSelectedSpell', () => {
    it('select un sort met isSelectingTarget à true', () => {
      useCombatStore.getState().setSelectedSpell('fireball');
      expect(useCombatStore.getState().selectedSpellId).toBe('fireball');
      expect(useCombatStore.getState().isSelectingTarget).toBe(true);
    });

    it('désélectionner remet à false', () => {
      useCombatStore.getState().setSelectedSpell('fireball');
      useCombatStore.getState().setSelectedSpell(null);
      expect(useCombatStore.getState().selectedSpellId).toBeNull();
      expect(useCombatStore.getState().isSelectingTarget).toBe(false);
    });
  });

  describe('addLog', () => {
    it('ajoute un log en tête', () => {
      useCombatStore.getState().addLog('test message', 'info');
      expect(useCombatStore.getState().logs[0]).toMatchObject({
        message: 'test message',
        type: 'info',
      });
    });

    it('déduplique les logs consécutifs identiques', () => {
      useCombatStore.getState().addLog('spam', 'info');
      useCombatStore.getState().addLog('spam', 'info');
      useCombatStore.getState().addLog('spam', 'info');
      expect(useCombatStore.getState().logs).toHaveLength(1);
    });

    it('ne déduplique pas si le type diffère', () => {
      useCombatStore.getState().addLog('x', 'info');
      useCombatStore.getState().addLog('x', 'damage');
      expect(useCombatStore.getState().logs).toHaveLength(2);
    });

    it('cappe à 50 entrées (rolling buffer)', () => {
      for (let i = 0; i < 60; i++) {
        useCombatStore.getState().addLog(`log ${i}`, 'info');
      }
      expect(useCombatStore.getState().logs).toHaveLength(50);
      expect(useCombatStore.getState().logs[0].message).toBe('log 59');
    });

    it('support des 3 types: damage, info, victory', () => {
      useCombatStore.getState().addLog('dmg', 'damage');
      useCombatStore.getState().addLog('info', 'info');
      useCombatStore.getState().addLog('victory', 'victory');
      expect(useCombatStore.getState().logs.map((l) => l.type)).toEqual([
        'victory',
        'info',
        'damage',
      ]);
    });
  });

  describe('setUiMessage', () => {
    it('set un message info par défaut', () => {
      useCombatStore.getState().setUiMessage('hello');
      expect(useCombatStore.getState().uiMessage).toMatchObject({
        text: 'hello',
        type: 'info',
      });
    });

    it('set un message error explicite', () => {
      useCombatStore.getState().setUiMessage('oops', 'error');
      expect(useCombatStore.getState().uiMessage?.type).toBe('error');
    });

    it('setUiMessage(null) clear le message', () => {
      useCombatStore.getState().setUiMessage('x');
      useCombatStore.getState().setUiMessage(null);
      expect(useCombatStore.getState().uiMessage).toBeNull();
    });

    it('génère un id unique pour chaque message', () => {
      useCombatStore.getState().setUiMessage('a');
      const id1 = useCombatStore.getState().uiMessage?.id;
      useCombatStore.getState().setUiMessage('b');
      const id2 = useCombatStore.getState().uiMessage?.id;
      expect(id1).not.toBe(id2);
    });
  });

  describe('surrender', () => {
    it('appelle combatApi.playAction avec SURRENDER', async () => {
      useCombatStore.setState({ sessionId: 's1', combatState: fakeCombatState });
      mocks.combatApi.playAction.mockResolvedValue({ data: {} });
      await useCombatStore.getState().surrender();
      expect(mocks.combatApi.playAction).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ type: expect.stringMatching(/SURRENDER/) }),
      );
    });

    it('ne fait rien si pas de sessionId', async () => {
      useCombatStore.setState({ sessionId: null, combatState: null });
      await useCombatStore.getState().surrender();
      expect(mocks.combatApi.playAction).not.toHaveBeenCalled();
    });

    it('ne fait rien si combatState est null', async () => {
      useCombatStore.setState({ sessionId: 's1', combatState: null });
      await useCombatStore.getState().surrender();
      expect(mocks.combatApi.playAction).not.toHaveBeenCalled();
    });
  });
});

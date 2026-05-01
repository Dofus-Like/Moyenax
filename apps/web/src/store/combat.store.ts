import { CombatActionType, CombatState } from '@game/shared-types';
import { create } from 'zustand';
import { combatApi } from '../api/combat.api';
import { useAuthStore } from './auth.store';

interface CombatLog {
  id: string;
  message: string;
  type: 'damage' | 'info' | 'victory';
}

interface SpellCastEvent {
  casterId: string;
  spellId: string;
  visualType: string;
  targetX: number;
  targetY: number;
  timestamp: number;
}

interface DamageEvent {
  targetId: string;
  damage: number;
  remainingVit?: number;
  timestamp: number;
}

interface HealEvent {
  targetId: string;
  heal: number;
  remainingVit?: number;
  timestamp: number;
}

interface JumpEvent {
  playerId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  timestamp: number;
}

interface UiMessage {
  id: string;
  text: string;
  type: 'info' | 'error';
}

interface CombatStore {
  combatState: CombatState | null;
  sessionId: string | null;
  sseConnection: EventSource | null;
  selectedSpellId: string | null;
  isSelectingTarget: boolean;
  logs: CombatLog[];
  lastSpellCast: SpellCastEvent | null;
  lastDamageEvent: DamageEvent | null;
  lastHealEvent: HealEvent | null;
  lastJumpEvent: JumpEvent | null;
  winnerId: string | null;
  showEnemyHp: boolean;
  showMannequins: boolean;
  uiMessage: UiMessage | null;
  _currentConnectionId: string | null;

  setCombatState: (state: CombatState) => void;
  setSelectedSpell: (spellId: string | null) => void;
  toggleShowEnemyHp: () => void;
  toggleShowMannequins: () => void;
  connectToSession: (sessionId: string) => Promise<void>;
  disconnect: () => void;
  addLog: (message: string, type: CombatLog['type']) => void;
  clearLogs: () => void;
  setUiMessage: (text: string | null, type?: UiMessage['type']) => void;
  surrender: () => Promise<void>;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  combatState: null,
  sessionId: null,
  sseConnection: null,
  selectedSpellId: null,
  isSelectingTarget: false,
  logs: [],
  lastSpellCast: null,
  lastDamageEvent: null,
  lastHealEvent: null,
  lastJumpEvent: null,
  winnerId: null,
  showEnemyHp: true,
  showMannequins: true,
  uiMessage: null,
  _currentConnectionId: null,

  toggleShowEnemyHp: () => set((state) => ({ showEnemyHp: !state.showEnemyHp })),
  toggleShowMannequins: () => set((state) => ({ showMannequins: !state.showMannequins })),

  setCombatState: (state: CombatState) => {
    set({
      combatState: { ...state },
      winnerId: state.winnerId || null,
    });
  },

  setSelectedSpell: (spellId: string | null) => {
    set({ selectedSpellId: spellId, isSelectingTarget: !!spellId });
  },

  clearLogs: () => set({ logs: [] }),

  addLog: (message: string, type: CombatLog['type']) => {
    const newLog = { id: createId('combat-log'), message, type };
    set((state) => {
      const lastLog = state.logs[0];
      if (lastLog && lastLog.message === message && lastLog.type === type) {
        return { logs: state.logs };
      }

      return { logs: [newLog, ...state.logs].slice(0, 50) };
    });
  },

  setUiMessage: (text, type = 'info') => {
    set({
      uiMessage: text ? { id: createId('combat-ui'), text, type } : null,
    });
  },

  connectToSession: async (sessionId: string) => {
    if (get().sessionId === sessionId && get().sseConnection) return;

    const connectionId = Math.random().toString(36).slice(2, 11);
    const existing = get().sseConnection;
    if (existing) {
      existing.close();
    }

    set({
      sessionId,
      logs: [],
      winnerId: null,
      sseConnection: null,
      lastSpellCast: null,
      lastDamageEvent: null,
      lastHealEvent: null,
      lastJumpEvent: null,
      uiMessage: null,
      _currentConnectionId: connectionId,
    });

    try {
      const response = await combatApi.getState(sessionId);
      if (get()._currentConnectionId !== connectionId) return;

      set({
        combatState: response.data,
        winnerId: response.data.winnerId || null,
      });
      get().addLog('Combat initialise', 'info');
    } catch (error) {
      console.error('Failed to fetch initial state', error);
      if (get()._currentConnectionId !== connectionId) return;
      get().setUiMessage(getErrorMessage(error, 'Impossible de charger le combat.'), 'error');
      return;
    }

    let reconnectTimer: number | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (reconnectTimer !== null || get()._currentConnectionId !== connectionId) {
        return;
      }

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void openStream();
      }, 1500);
    };

    const openStream = async () => {
      if (get()._currentConnectionId !== connectionId) {
        return;
      }

      try {
        const ticketResponse = await combatApi.getStreamTicket(sessionId);
        if (get()._currentConnectionId !== connectionId) {
          return;
        }

        const ticket = encodeURIComponent(ticketResponse.data.ticket);
        const eventSource = new EventSource(
          `${window.location.origin}/api/v1/combat/session/${sessionId}/events?ticket=${ticket}`,
        );

        const withConnectionGuard =
          <T,>(handler: (data: T) => void) =>
            (event: MessageEvent) => {
              if (get()._currentConnectionId !== connectionId) {
                eventSource.close();
                return;
              }

              try {
                const data = JSON.parse(event.data) as T;
                handler(data);
              } catch (error) {
                console.error('SSE parse error', error);
              }
            };

        eventSource.addEventListener(
          'STATE_UPDATED',
          withConnectionGuard<CombatState>((data) => {
            set({ combatState: data, winnerId: data.winnerId || null });
          }),
        );

        eventSource.addEventListener(
          'SPELL_CAST',
          withConnectionGuard<Omit<SpellCastEvent, 'timestamp'>>((data) => {
            set({ lastSpellCast: { ...data, timestamp: Date.now() } });
          }),
        );

        eventSource.addEventListener(
          'TURN_STARTED',
          withConnectionGuard<{ playerId: string }>((data) => {
            const player = get().combatState?.players[data.playerId];
            const isSelf = data.playerId === useAuthStore.getState().player?.id;
            const displayName = player?.username || (isSelf ? 'Vous' : 'Adversaire');
            get().addLog(`Debut du tour de ${displayName}`, 'info');
          }),
        );

        eventSource.addEventListener(
          'DAMAGE_DEALT',
          withConnectionGuard<Omit<DamageEvent, 'timestamp'>>((data) => {
            set({ lastDamageEvent: { ...data, timestamp: Date.now() } });
            const player = get().combatState?.players[data.targetId];
            const isSelf = data.targetId === useAuthStore.getState().player?.id;
            const displayName = player?.username || (isSelf ? 'Vous' : 'Adversaire');
            get().addLog(`-${data.damage} PV sur ${displayName}`, 'damage');
          }),
        );

        eventSource.addEventListener(
          'HEAL_DEALT',
          withConnectionGuard<Omit<HealEvent, 'timestamp'>>((data) => {
            set({ lastHealEvent: { ...data, timestamp: Date.now() } });
          }),
        );

        eventSource.addEventListener(
          'PLAYER_JUMPED',
          withConnectionGuard<Omit<JumpEvent, 'timestamp'>>((data) => {
            set({ lastJumpEvent: { ...data, timestamp: Date.now() } });
          }),
        );

        eventSource.addEventListener(
          'COMBAT_ENDED',
          withConnectionGuard<{ winnerId: string }>((data) => {
            const player = get().combatState?.players[data.winnerId];
            const isMe = data.winnerId === useAuthStore.getState().player?.id;
            const displayName = player?.username || (isMe ? 'Vous' : 'Adversaire');
            get().addLog(`Combat fini. Vainqueur : ${displayName}`, 'victory');
            set({ winnerId: data.winnerId });
          }),
        );

        eventSource.onerror = (error) => {
          if (get()._currentConnectionId !== connectionId) {
            eventSource.close();
            return;
          }

          console.error('SSE connection error', error);
          eventSource.close();
          set({ sseConnection: null });
          get().setUiMessage('La connexion temps reel a ete interrompue.', 'error');
          scheduleReconnect();
        };

        clearReconnectTimer();
        set({ sseConnection: eventSource });
      } catch (error) {
        if (get()._currentConnectionId !== connectionId) {
          return;
        }

        console.error('Failed to open combat SSE', error);
        get().setUiMessage(getErrorMessage(error, 'Impossible d ouvrir le flux temps reel.'), 'error');
        scheduleReconnect();
      }
    };

    await openStream();
  },

  disconnect: () => {
    const connection = get().sseConnection;
    if (connection) {
      connection.close();
    }

    set({
      combatState: null,
      sessionId: null,
      sseConnection: null,
      selectedSpellId: null,
      isSelectingTarget: false,
      logs: [],
      winnerId: null,
      lastSpellCast: null,
      lastDamageEvent: null,
      lastHealEvent: null,
      lastJumpEvent: null,
      uiMessage: null,
      _currentConnectionId: null,
    });
  },

  surrender: async () => {
    const { sessionId, combatState } = get();
    if (!sessionId || !combatState) return;

    if (window.confirm('Voulez-vous vraiment abandonner ?')) {
      try {
        const response = await combatApi.playAction(sessionId, { type: CombatActionType.SURRENDER });
        if (response?.data) {
          get().setCombatState(response.data);
        }
      } catch (error) {
        get().setUiMessage(getErrorMessage(error, "Impossible d'abandonner le combat."), 'error');
      }
    }
  },
}));

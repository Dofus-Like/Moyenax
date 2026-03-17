import { create } from 'zustand';
import { CombatState } from '@game/shared-types';

interface CombatStore {
  combatState: CombatState | null;
  sessionId: string | null;
  sseConnection: EventSource | null;
  setCombatState: (state: CombatState) => void;
  connectToSession: (sessionId: string) => void;
  disconnect: () => void;
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  combatState: null,
  sessionId: null,
  sseConnection: null,

  setCombatState: (state: CombatState) => {
    set({ combatState: state });
  },

  connectToSession: (sessionId: string) => {
    const existing = get().sseConnection;
    if (existing) {
      existing.close();
    }

    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const eventSource = new EventSource(`${apiUrl}/combat/session/${sessionId}/events`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as CombatState;
      set({ combatState: data });
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };

    set({ sessionId, sseConnection: eventSource });
  },

  disconnect: () => {
    const connection = get().sseConnection;
    if (connection) {
      connection.close();
    }
    set({ combatState: null, sessionId: null, sseConnection: null });
  },
}));

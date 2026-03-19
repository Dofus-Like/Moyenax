import { create } from 'zustand';
import { CombatState, CombatAction, CombatActionType } from '@game/shared-types';
import { combatApi } from '../api/combat.api';
import { useAuthStore } from './auth.store';

interface CombatLog {
  id: string;
  message: string;
  type: 'damage' | 'info' | 'victory';
}

interface CombatStore {
  combatState: CombatState | null;
  sessionId: string | null;
  sseConnection: EventSource | null;
  selectedSpellId: string | null;
  isSelectingTarget: boolean;
  logs: CombatLog[];
  lastSpellCast: { casterId: string; spellId: string; visualType: string; targetX: number; targetY: number; timestamp: number } | null;
  winnerId: string | null;
  showEnemyHp: boolean;
  _currentConnectionId: string | null;
  
  setCombatState: (state: CombatState) => void;
  setSelectedSpell: (spellId: string | null) => void;
  toggleShowEnemyHp: () => void;
  connectToSession: (sessionId: string) => Promise<void>;
  disconnect: () => void;
  addLog: (message: string, type: CombatLog['type']) => void;
  surrender: () => Promise<void>;
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  combatState: null,
  sessionId: null,
  sseConnection: null,
  selectedSpellId: null,
  isSelectingTarget: false,
  logs: [],
  lastSpellCast: null,
  winnerId: null,
  showEnemyHp: true, // Toujours afficher par défaut comme demandé
  _currentConnectionId: null,
  
  toggleShowEnemyHp: () => set((s) => ({ showEnemyHp: !s.showEnemyHp })),

  setCombatState: (state: CombatState) => {
    set({ combatState: { ...state }, winnerId: state.winnerId || null });
  },

  setSelectedSpell: (spellId: string | null) => {
    set({ selectedSpellId: spellId, isSelectingTarget: !!spellId });
  },

  addLog: (message: string, type: CombatLog['type']) => {
    const newLog = { id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, message, type };
    set((state) => {
      // Éviter de rajouter EXACTEMENT le même message si le dernier log est identique (sécurité supplémentaire)
      const lastLog = state.logs[0];
      if (lastLog && lastLog.message === message && lastLog.type === type) {
          return { logs: state.logs };
      }
      return { logs: [newLog, ...state.logs].slice(0, 50) };
    });
  },

  connectToSession: async (sessionId: string) => {
    // Si on est déjà branché sur cette session et qu'on a une connexion, on ne fait rien
    if (get().sessionId === sessionId && get().sseConnection) return;

    const connectionId = Math.random().toString(36).substr(2, 9);
    
    // On ferme l'ancienne si besoin AVANT de lancer la nouvelle
    const existing = get().sseConnection;
    if (existing) {
      existing.close();
    }

    // On marque la session immédiatement et on vide les logs
    set({ sessionId, logs: [], winnerId: null, sseConnection: null, _currentConnectionId: connectionId });

    try {
        const response = await combatApi.getState(sessionId);
        
        // Sécurité: si entre-temps le disconnect a été appelé ou une autre connexion lancée
        if (get()._currentConnectionId !== connectionId) return;

        set({ combatState: response.data, lastSpellCast: null });
        get().addLog('Combat initialisé', 'info');
    } catch (err) {
        console.error('Failed to fetch initial state', err);
        if (get()._currentConnectionId !== connectionId) return;
    }

    const token = useAuthStore.getState().token;
    const sseUrl = `${window.location.origin}/api/v1/combat/session/${sessionId}/events?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    // Closure-safe handlers that check connection ID
    const withConnectionGuard = (handler: (data: any) => void) => (event: MessageEvent) => {
        if (get()._currentConnectionId !== connectionId) {
            eventSource.close();
            return;
        }
        try {
            const data = JSON.parse(event.data);
            handler(data);
        } catch (e) {
            console.error('SSE Parse error', e);
        }
    };

    eventSource.addEventListener('STATE_UPDATED', withConnectionGuard((data) => {
        set({ combatState: data });
    }));

    eventSource.addEventListener('SPELL_CAST', withConnectionGuard((data) => {
        set({ lastSpellCast: { ...data, timestamp: Date.now() } });
    }));

    eventSource.addEventListener('TURN_STARTED', withConnectionGuard((data) => {
        const player = get().combatState?.players[data.playerId];
        const isSelf = data.playerId === useAuthStore.getState().player?.id;
        const displayName = player?.username || (isSelf ? 'Vous' : 'Adversaire');
        get().addLog(`Debut du tour de ${displayName}`, 'info');
    }));

    eventSource.addEventListener('DAMAGE_DEALT', withConnectionGuard((data) => {
        const player = get().combatState?.players[data.targetId];
        const isSelf = data.targetId === useAuthStore.getState().player?.id;
        const displayName = player?.username || (isSelf ? 'Vous' : 'Adversaire');
        get().addLog(`-${data.damage} PV sur ${displayName}`, 'damage');
    }));

    eventSource.addEventListener('COMBAT_ENDED', withConnectionGuard((data) => {
        const player = get().combatState?.players[data.winnerId];
        const isMe = data.winnerId === useAuthStore.getState().player?.id;
        const displayName = player?.username || (isMe ? 'Vous' : 'Adversaire');
        
        get().addLog(`Combat fini. Vainqueur : ${displayName}`, 'victory');
        set({ winnerId: data.winnerId });
    }));

    eventSource.onerror = (err) => {
      if (get()._currentConnectionId === connectionId) {
        console.error('SSE connection error', err);
      } else {
        eventSource.close();
      }
    };

    set({ sseConnection: eventSource });
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
      _currentConnectionId: null // Très important pour stopper les listeners en cours
    });
  },

  surrender: async () => {
    const { sessionId, combatState } = get();
    if (!sessionId || !combatState) return;

    if (window.confirm('Voulez-vous vraiment abandonner ?')) {
        await combatApi.playAction(sessionId, { type: 'SURRENDER' as any });
    }
  },
}));


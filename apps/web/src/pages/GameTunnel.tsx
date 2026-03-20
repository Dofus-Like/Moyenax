import React, { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { gameSessionApi } from '../api/game-session.api';
import { useAuthStore } from '../store/auth.store';

interface GameSession {
  id: string;
  status: string;
  phase: 'FARMING' | 'FIGHTING';
  currentRound: number;
  player1Wins: number;
  player2Wins: number;
  player1Ready: boolean;
  player2Ready: boolean;
  player1Id: string;
  player2Id: string | null;
  gold: number;
  combats: any[];
}

interface GameSessionContextType {
  activeSession: GameSession | null;
  /** silent: ne touche pas à `loading` (évite flash / écran bloqué sur les pages tunnel lors des refresh manuels) */
  refreshSession: (opts?: { silent?: boolean }) => Promise<void>;
  loading: boolean;
}

const GameSessionContext = createContext<GameSessionContextType | undefined>(undefined);

/** Pages tunnel « internes » : naviguer entre elles ne doit pas refetch la session (évite courses + éjection du tunnel). */
const TUNNEL_SWAP_PATHS = ['/farming', '/inventory', '/shop', '/crafting'] as const;

function isTunnelSwapPath(pathname: string): boolean {
  return TUNNEL_SWAP_PATHS.some((p) => pathname.startsWith(p));
}

function isInternalTunnelNavigation(prev: string, next: string): boolean {
  return isTunnelSwapPath(prev) && isTunnelSwapPath(next);
}

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const prevPathnameRef = useRef<string | undefined>(undefined);

  const refreshSession = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      setActiveSession(null);
      if (!silent) {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await gameSessionApi.getActiveSession();
      setActiveSession(res.data ?? null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setActiveSession(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const path = location.pathname;
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = path;

    if (prev === undefined) {
      void refreshSession();
      return;
    }
    if (isInternalTunnelNavigation(prev, path)) {
      return;
    }
    void refreshSession();
  }, [location.pathname, refreshSession]);

  // Écouter les mises à jour en temps réel via SSE
  useEffect(() => {
    if (!activeSession) return;

    const token = useAuthStore.getState().token;
    const eventSource = new EventSource(`/api/v1/game-session/session/${activeSession.id}/events?token=${token}`);

    // Nest envoie `event: SESSION_UPDATED` — seul addEventListener reçoit ces messages, pas onmessage.
    const onSessionUpdated = (event: MessageEvent) => {
      try {
        const next = JSON.parse(event.data) as GameSession;
        if (next && typeof next === 'object' && 'id' in next) {
          setActiveSession((prev) =>
            prev && prev.id === next.id ? { ...prev, ...next } : next,
          );
        }
      } catch (err) {
        console.error('Erreur parsing SSE:', err);
      }
    };

    eventSource.addEventListener('SESSION_UPDATED', onSessionUpdated);

    return () => {
      eventSource.removeEventListener('SESSION_UPDATED', onSessionUpdated);
      eventSource.close();
    };
  }, [activeSession?.id]);

  return (
    <GameSessionContext.Provider value={{ activeSession, refreshSession, loading }}>
      {children}
    </GameSessionContext.Provider>
  );
}

export const useGameSession = () => {
  const context = useContext(GameSessionContext);
  if (!context) throw new Error('useGameSession must be used within GameSessionProvider');
  return context;
};

export function GameTunnelGuard({ children }: { children: React.ReactNode }) {
  const { activeSession, loading } = useGameSession();
  const location = useLocation();

  if (loading) return <div className="loading-screen">Chargement de la session...</div>;

  // Si on a une session ACTIVE, on RESTREINT l'accès au Lobby (/)
  if (activeSession && activeSession.status === 'ACTIVE' && location.pathname === '/') {
    // Rediriger vers la map de farming par défaut dans le tunnel
    return <Navigate to="/farming" replace />;
  }

  // Pages « tunnel » : partie active ou ?debug=true (même règle que le farming debug)
  const gamePaths = ['/farming', '/combat', '/inventory', '/shop', '/crafting'];
  const isGamePath = gamePaths.some((path) => location.pathname.startsWith(path));
  const isDebugTunnel = new URLSearchParams(location.search).get('debug') === 'true';
  const tunnelAllowed =
    (activeSession && activeSession.status === 'ACTIVE') || isDebugTunnel;

  if (isGamePath && !tunnelAllowed) {
    return <Navigate to="/" replace />;
  }

  // Si on n'a PAS de session active, on RESTREINT l'accès aux pages de jeu (farming, combat, etc.) ?
  // En fait, le user veut qu'on rentre dans le tunnel via matchmaking.
  // Pour l'instant on va juste bloquer le lobby si session active.
  
  return <>{children}</>;
}

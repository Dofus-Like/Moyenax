import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { gameSessionApi } from '../api/game-session.api';
import { useAuthStore } from '../store/auth.store';
import { useCombatStore } from '../store/combat.store';
import { useFarmingStore } from '../store/farming.store';

interface GameSession {
  id: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  phase: 'FARMING' | 'FIGHTING';
  currentRound: number;
  player1Wins: number;
  player2Wins: number;
  player1Ready: boolean;
  player2Ready: boolean;
  player1Id: string;
  player2Id: string | null;
  gold: number;
  player1Po: number;
  player2Po: number;
  combats: Array<{
    id: string;
    status: 'WAITING' | 'ACTIVE' | 'FINISHED';
    createdAt: string;
    winnerId?: string | null;
  }>;
}

interface GameSessionContextType {
  activeSession: GameSession | null;
  refreshSession: (opts?: { silent?: boolean }) => Promise<void>;
  loading: boolean;
}

const GameSessionContext = createContext<GameSessionContextType | undefined>(undefined);
const TUNNEL_SWAP_PATHS = ['/farming', '/inventory', '/shop', '/crafting'] as const;

function isTunnelSwapPath(pathname: string): boolean {
  return TUNNEL_SWAP_PATHS.some((path) => pathname.startsWith(path));
}

function isInternalTunnelNavigation(prev: string, next: string): boolean {
  return isTunnelSwapPath(prev) && isTunnelSwapPath(next);
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { status?: unknown } }).response?.status === 'number'
  ) {
    return (error as { response?: { status?: number } }).response?.status;
  }

  return undefined;
}

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const prevPathnameRef = useRef<string | undefined>(undefined);
  const prevSessionIdRef = useRef<string | null>(null);

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await gameSessionApi.getActiveSession({ signal: controller.signal });
      clearTimeout(timeoutId);
      setActiveSession(response.data ?? null);
    } catch (error: unknown) {
      if (getErrorStatus(error) === 401) {
        setActiveSession(null);
      }
      console.error('[GameTunnel] Failed to refresh session:', error);
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

  useEffect(() => {
    if (!activeSession?.id) {
      return;
    }

    const refreshSilently = () => {
      void refreshSession({ silent: true });
    };

    const pollTimer = window.setInterval(refreshSilently, 4000);
    const handleWindowFocus = () => refreshSilently();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSilently();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeSession?.id, refreshSession]);

  useEffect(() => {
    const nextSessionId = activeSession?.id ?? null;

    if (prevSessionIdRef.current !== nextSessionId) {
      useCombatStore.getState().disconnect();
      useFarmingStore.getState().reset();
      prevSessionIdRef.current = nextSessionId;
      return;
    }

    if (nextSessionId === null) {
      useCombatStore.getState().disconnect();
      useFarmingStore.getState().reset();
    }
  }, [activeSession?.id, activeSession?.status]);

  useEffect(() => {
    if (!activeSession) return;

    let closed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;

    const onSessionUpdated = (event: MessageEvent) => {
      try {
        const next = JSON.parse(event.data) as GameSession;
        if (!next || typeof next !== 'object' || !('id' in next)) {
          return;
        }

        setActiveSession((prev) => {
          console.log(
            `[GameTunnel] SSE Update for session ${next.id}: status=${next.status}, phase=${next.phase}, combats=${next.combats?.length}`,
          );
          return prev && prev.id === next.id ? { ...prev, ...next } : next;
        });
      } catch (error) {
        console.error('Erreur parsing SSE:', error);
      }
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) {
        return;
      }

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, 1500);
    };

    const cleanupSource = () => {
      if (!eventSource) {
        return;
      }

      eventSource.removeEventListener('SESSION_UPDATED', onSessionUpdated);
      eventSource.close();
      eventSource = null;
    };

    const connect = async () => {
      try {
        const ticketResponse = await gameSessionApi.getStreamTicket(activeSession.id);
        if (closed) {
          return;
        }

        cleanupSource();

        const ticket = encodeURIComponent(ticketResponse.data.ticket);
        eventSource = new EventSource(
          `/api/v1/game-session/session/${activeSession.id}/events?ticket=${ticket}`,
        );
        eventSource.addEventListener('SESSION_UPDATED', onSessionUpdated);
        eventSource.onerror = (error) => {
          if (closed) {
            cleanupSource();
            return;
          }

          console.error('Erreur SSE session:', error);
          cleanupSource();
          scheduleReconnect();
        };
      } catch (error) {
        if (closed) {
          return;
        }

        const status = getErrorStatus(error);
        if (status === 401 || status === 403) {
          setActiveSession(null);
          return;
        }

        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      cleanupSource();
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

  if (activeSession && activeSession.status === 'ACTIVE' && location.pathname === '/') {
    return <Navigate to="/farming" replace />;
  }

  const gamePaths = ['/farming', '/combat', '/inventory', '/shop', '/crafting'];
  const isGamePath = gamePaths.some((path) => location.pathname.startsWith(path));
  const isDebugTunnel = new URLSearchParams(location.search).get('debug') === 'true';
  const tunnelAllowed = (activeSession && activeSession.status === 'ACTIVE') || isDebugTunnel;

  if (isGamePath && !tunnelAllowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

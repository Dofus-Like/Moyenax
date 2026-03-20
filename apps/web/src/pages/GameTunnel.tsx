import React, { useEffect, useState, createContext, useContext } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { gameSessionApi } from '../api/game-session.api';

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
}

interface GameSessionContextType {
  activeSession: GameSession | null;
  refreshSession: () => Promise<void>;
  loading: boolean;
}

const GameSessionContext = createContext<GameSessionContextType | undefined>(undefined);

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const refreshSession = async () => {
    try {
      const res = await gameSessionApi.getActiveSession();
      setActiveSession(res.data);
    } catch (err) {
      console.error('No active session found', err);
      setActiveSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, [location.pathname]);

  // Écouter les mises à jour en temps réel via SSE
  useEffect(() => {
    if (!activeSession) return;

    const eventSource = new EventSource(`/api/v1/sse/events?channel=game-session:${activeSession.id}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SESSION_UPDATED') {
          setActiveSession(data.payload);
        }
      } catch (err) {
        console.error('Erreur parsing SSE:', err);
      }
    };

    return () => {
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

  // Si on a une session active, on RESTREINT l'accès au Lobby (/)
  if (activeSession && location.pathname === '/') {
    // Rediriger vers la map de farming par défaut dans le tunnel ?
    return <Navigate to="/farming" replace />;
  }

  // Si on n'a PAS de session active, on RESTREINT l'accès aux pages de jeu (farming, combat, etc.) ?
  // En fait, le user veut qu'on rentre dans le tunnel via matchmaking.
  // Pour l'instant on va juste bloquer le lobby si session active.
  
  return <>{children}</>;
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { gameSessionApi } from '../api/game-session.api';
import { SKINS } from '../game/constants/skins';
import { useAuthStore } from '../store/auth.store';
import { useGameSession } from './GameTunnel';
import './LobbyPage.css';

interface Room {
  id: string;
  player1Id: string;
  player2Id: string | null;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  createdAt: string;
  p1: {
    username: string;
  };
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

  return fallback;
}

export function LobbyPage() {
  const { player, initialize, setSkin } = useAuthStore();
  const { activeSession, refreshSession } = useGameSession();
  const navigate = useNavigate();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(true);
  const [isInQueue, setIsInQueue] = React.useState(false);

  const fetchLobbyState = React.useCallback(async () => {
    try {
      const [roomsResponse, queueResponse] = await Promise.all([
        gameSessionApi.getWaitingSessions(),
        gameSessionApi.getQueueStatus(),
      ]);

      setRooms(roomsResponse.data);
      setIsInQueue(Boolean(queueResponse.data?.queued) && !activeSession);
    } catch (error) {
      console.error('Failed to fetch lobby state', error);
    } finally {
      setLoadingRooms(false);
    }
  }, [activeSession]);

  React.useEffect(() => {
    void initialize();
    void fetchLobbyState();
    const interval = window.setInterval(() => {
      void fetchLobbyState();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [fetchLobbyState, initialize]);

  React.useEffect(() => {
    void fetchLobbyState();
  }, [activeSession?.id, activeSession?.status, fetchLobbyState]);

  React.useEffect(() => {
    if (!activeSession) {
      return;
    }

    setIsInQueue(false);

    if (activeSession.status === 'ACTIVE') {
      navigate('/farming');
    }
  }, [activeSession, navigate]);

  const handleCreateRoom = async () => {
    try {
      await gameSessionApi.createPrivateSession();
      await refreshSession({ silent: true });
      await fetchLobbyState();
    } catch (error) {
      console.error('Failed to create room', error);
      window.alert(getErrorMessage(error, 'Impossible de creer la room.'));
    }
  };

  const handleCancelOpenSession = async () => {
    if (!activeSession) return;

    try {
      await gameSessionApi.endSession(activeSession.id);
      await refreshSession({ silent: true });
      await fetchLobbyState();
    } catch (error) {
      console.error('Failed to cancel room', error);
      window.alert(getErrorMessage(error, 'Impossible d annuler la room.'));
    }
  };

  const handleJoinRoom = async (sessionId: string) => {
    try {
      await gameSessionApi.joinPrivateSession(sessionId);
      await refreshSession({ silent: true });
      navigate('/farming');
    } catch (error) {
      console.error('Failed to join room', error);
      const msg = getErrorMessage(error, 'Impossible de rejoindre la room.');
      if (msg.includes('deja une room ouverte')) {
        if (window.confirm('Vous avez déjà une session active. Voulez-vous la rejoindre ?')) {
          navigate('/farming');
        }
      } else {
        window.alert(msg);
      }
    }
  };

  const handleResetSession = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir réinitialiser votre session ? Toute progression non sauvegardée sera perdue.')) {
      return;
    }

    try {
      await gameSessionApi.resetSession();
      await refreshSession({ silent: true });
      await fetchLobbyState();
      window.alert('Session réinitialisée avec succès.');
    } catch (error) {
      console.error('Failed to reset session', error);
      window.alert(getErrorMessage(error, 'Impossible de réinitialiser la session.'));
    }
  };

  const handleStartVsAiCombat = async () => {
    try {
      await gameSessionApi.startVsAi();
      await refreshSession({ silent: true });
      navigate('/farming');
    } catch (error) {
      console.error('Failed to start VS AI combat', error);
      window.alert(getErrorMessage(error, 'Impossible de lancer le combat VS AI.'));
    }
  };

  const handleJoinQueue = async () => {
    try {
      const response = await gameSessionApi.joinQueue();
      if (response.data?.status === 'matched') {
        await refreshSession({ silent: true });
        setIsInQueue(false);
        navigate('/farming');
        return;
      }

      setIsInQueue(true);
    } catch (error) {
      console.error('Failed to join queue', error);
      setIsInQueue(false);
      window.alert(getErrorMessage(error, 'Impossible de rejoindre la file.'));
    }
  };

  const handleLeaveQueue = async () => {
    try {
      await gameSessionApi.leaveQueue();
      setIsInQueue(false);
    } catch (error) {
      console.error('Failed to leave queue', error);
      window.alert(getErrorMessage(error, 'Impossible de quitter la file.'));
    }
  };

  React.useEffect(() => {
    if (!isInQueue) return;

    const interval = window.setInterval(async () => {
      try {
        const [sessionResponse, queueResponse] = await Promise.all([
          gameSessionApi.getActiveSession(),
          gameSessionApi.getQueueStatus(),
        ]);

        if (sessionResponse.data && sessionResponse.data.status === 'ACTIVE') {
          setIsInQueue(false);
          await refreshSession({ silent: true });
          navigate('/farming');
          return;
        }

        setIsInQueue(Boolean(queueResponse.data?.queued));
      } catch (error) {
        console.error('Error polling queue/session:', error);
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [isInQueue, navigate, refreshSession]);

  const hasOpenSession = !!activeSession;
  const isWaitingPrivateSession =
    activeSession?.status === 'WAITING' &&
    activeSession.player1Id === player?.id &&
    activeSession.player2Id == null;
  const visibleRooms = React.useMemo(
    () => rooms.filter((room) => room.status === 'WAITING' && room.player2Id == null),
    [rooms],
  );

  return (
    <div className="lobby-container">
      <section className="lobby-skins">
        <div className="lobby-section-header">
          <h2>🎭 Choisissez votre apparence</h2>
        </div>
        <div className="skins-grid">
          {SKINS.map((skin) => (
            <div
              key={skin.id}
              className={`skin-card ${player?.skin === skin.id ? 'active' : ''}`}
              onClick={() => void setSkin(skin.id)}
            >
              <div className="skin-preview-container">
                <div
                  className={`skin-sprite-icon type-${skin.type} avatar-${skin.type === 'soldier' ? 'soldier' : 'orc'}`}
                  style={{
                    filter: `hue-rotate(${skin.hue}deg) saturate(${skin.saturation})`,
                    backgroundImage: `url(/assets/sprites/${skin.type}/idle.png)`,
                  }}
                />
              </div>
              <div className="skin-info">
                <span className="skin-name">{skin.name}</span>
                <span className="skin-desc">{skin.description}</span>
              </div>
              {player?.skin === skin.id && <div className="skin-current-badge">ACTIF</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="lobby-matchmaking parchment-container">
        <div className="matchmaking-card">
          <div className="matchmaking-info">
            <h3>🎮 Match aléatoire</h3>
            <p>Affrontez un adversaire dans le tunnel de jeu.</p>
          </div>
          {isInQueue ? (
            <div className="queue-status">
              <div className="loader-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </div>
              <span>Recherche d&apos;un adversaire...</span>
              <button type="button" className="leave-queue-btn" onClick={handleLeaveQueue}>
                Annuler
              </button>
            </div>
          ) : isWaitingPrivateSession ? (
            <div className="queue-status">
              <span>Votre room privée est en attente d&apos;un adversaire.</span>
              <button type="button" className="leave-queue-btn" onClick={handleCancelOpenSession}>
                Annuler la room
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="join-queue-btn"
              onClick={handleJoinQueue}
              disabled={hasOpenSession}
            >
              Lancer une recherche
            </button>
          )}
        </div>
      </section>

      <section className="lobby-combat parchment-container">
        <div className="lobby-section-header">
          <h2>⚔️ Rooms personnalisées</h2>
          <div className="lobby-combat-actions">
            <button
              type="button"
              className="lobby-btn action"
              onClick={isWaitingPrivateSession ? handleCancelOpenSession : handleCreateRoom}
              disabled={isInQueue || (hasOpenSession && !isWaitingPrivateSession)}
            >
              {isWaitingPrivateSession ? 'Annuler la room' : 'Créer une room'}
            </button>
          </div>
        </div>

        <div className="rooms-grid">
          {loadingRooms ? (
            <div className="no-rooms">Chargement des rooms...</div>
          ) : visibleRooms.length === 0 ? (
            <div className="no-rooms">Aucune room ouverte. Créez-en une !</div>
          ) : (
            visibleRooms.map((room) => (
              <div key={room.id} className="room-card">
                <div className="room-info">
                  <span className="room-host">{room.p1.username}</span>
                  <span className="room-date">{new Date(room.createdAt).toLocaleTimeString()}</span>
                </div>
                <button
                  type="button"
                  className="room-join-btn"
                  onClick={() => void handleJoinRoom(room.id)}
                  disabled={room.player1Id === player?.id || hasOpenSession || isInQueue}
                >
                  {room.player1Id === player?.id ? 'Votre room' : 'Rejoindre'}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="vs-ai-card">
          <div className="vs-ai-card-info">
            <h3>
              🤖 VS AI <span className="hot-badge">PROG</span>
            </h3>
            <p>Lancez un combat solo contre l&apos;IA depuis le lobby.</p>
          </div>
          <button
            type="button"
            className={`vs-ai-btn ${hasOpenSession ? 'resume' : ''}`}
            onClick={hasOpenSession ? () => navigate('/farming') : handleStartVsAiCombat}
            disabled={isInQueue}
          >
            {hasOpenSession ? 'Reprendre la partie' : 'Lancer VS AI'}
          </button>
          
          {hasOpenSession && (
            <button
              type="button"
              className="reset-session-link"
              onClick={handleResetSession}
            >
              🔄 Réinitialiser
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

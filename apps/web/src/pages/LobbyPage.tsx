import React from 'react';
import { useNavigate } from 'react-router-dom';
import { gameSessionApi } from '../api/game-session.api';
import { SKINS, getSkinById } from '../game/constants/skins';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import { useGameSession } from './GameTunnel';
import { ThemeToggle } from '../components/ThemeToggle';
import './LobbyPage.css';
import './LobbyPage.retro.css';

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
  const { player, logout, initialize, setSkin } = useAuthStore();
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
      window.alert(getErrorMessage(error, 'Impossible de rejoindre la room.'));
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
  const isRetro = useThemeStore((s) => s.theme) === 'retro';

  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <h1>{isRetro ? 'Moyenax' : '⚔️ Moyenax'}</h1>

        <div className="lobby-user-info">
          <div className="user-profile-summary">
            <span className="lobby-username">{player?.username ?? 'Joueur'}</span>
            <span className="lobby-skin-tag">{getSkinById(player?.skin || 'soldier-classic').name}</span>
          </div>
          <ThemeToggle />
          <button type="button" className="lobby-logout" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      {isRetro && <hr className="hr-groove" />}

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

      {isRetro && <hr className="hr-groove" />}

      <section className="lobby-matchmaking">
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

      {isRetro && <hr className="hr-groove" />}

      <section className="lobby-combat">
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
            className="vs-ai-btn"
            onClick={handleStartVsAiCombat}
            disabled={hasOpenSession || isInQueue}
          >
            Lancer VS AI
          </button>
        </div>
      </section>
    </div>
  );
}

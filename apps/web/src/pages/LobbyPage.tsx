import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { gameSessionApi } from '../api/game-session.api';
import { useGameSession } from './GameTunnel';
import { SKINS, getSkinById } from '../game/constants/skins';
import './LobbyPage.css';

interface Room {
  id: string;
  player1Id: string;
  p1: {
    username: string;
  };
  createdAt: string;
}

export function LobbyPage() {
  const { player, logout, initialize, setSkin } = useAuthStore();
  const { activeSession, refreshSession } = useGameSession();
  const navigate = useNavigate();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(true);
  const [isInQueue, setIsInQueue] = React.useState(false);

  const fetchRooms = React.useCallback(async () => {
    try {
      const res = await gameSessionApi.getWaitingSessions();
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  React.useEffect(() => {
    initialize();
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [initialize, fetchRooms]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateRoom = async () => {
    try {
      await gameSessionApi.createPrivateSession();
      fetchRooms();
      setIsInQueue(true);
    } catch (err) {
      console.error('Failed to create room', err);
    }
  };

  const handleJoinRoom = async (sessionId: string) => {
    try {
      await gameSessionApi.joinPrivateSession(sessionId);
      refreshSession();
      navigate(`/farming`);
    } catch (err) {
      console.error('Failed to join room', err);
    }
  };

  const handleStartVsAiCombat = async () => {
    try {
      await gameSessionApi.startVsAi();
      await refreshSession();
      navigate(`/farming`);
    } catch (err) {
      console.error('Failed to start VS AI combat', err);
    }
  };

  const handleJoinQueue = async () => {
    try {
      setIsInQueue(true);
      await gameSessionApi.joinQueue();
    } catch (err) {
      console.error('Failed to join queue', err);
      setIsInQueue(false);
    }
  };

  const handleLeaveQueue = async () => {
    try {
      await gameSessionApi.leaveQueue();
      setIsInQueue(false);
    } catch (err) {
      console.error('Failed to leave queue', err);
    }
  };

  React.useEffect(() => {
    if (!isInQueue) return;
    const interval = setInterval(async () => {
      try {
        const res = await gameSessionApi.getActiveSession();
        if (res.data && res.data.status === 'ACTIVE') {
          setIsInQueue(false);
          await refreshSession();
          navigate(`/farming`);
        }
      } catch (err) {
        console.error('Error polling session:', err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isInQueue, navigate, refreshSession]);

  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <div className="lobby-title-group">
          <h1>⚔️ RokeTag Arena</h1>
          <button className="vs-ai-btn" onClick={handleStartVsAiCombat}>
            VS AI <span className="hot-badge">PROG</span>
          </button>
        </div>

        <div className="lobby-user-info">
          <span className="lobby-gold">💰 {player?.gold ?? 0} or</span>
          <div className="user-profile-summary">
            <span className="lobby-username">{player?.username ?? 'Joueur'}</span>
            <span className="lobby-skin-tag">{getSkinById(player?.skin || 'soldier-classic').name}</span>
          </div>
          <button className="lobby-logout" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      <section className="lobby-skins">
        <div className="lobby-section-header">
          <h2>🎭 Choisissez votre apparence</h2>
        </div>
        <div className="skins-grid">
          {SKINS.map((skin) => (
            <div
              key={skin.id}
              className={`skin-card ${player?.skin === skin.id ? 'active' : ''}`}
              onClick={() => setSkin(skin.id)}
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
              <button className="leave-queue-btn" onClick={handleLeaveQueue}>
                Annuler
              </button>
            </div>
          ) : (
            <button className="join-queue-btn" onClick={handleJoinQueue} disabled={!!activeSession}>
              Lancer une recherche
            </button>
          )}
        </div>
      </section>

      <section className="lobby-combat">
        <div className="lobby-section-header">
          <h2>⚔️ Rooms personnalisées</h2>
          <div className="lobby-combat-actions">
            <button className="lobby-btn action" onClick={handleCreateRoom} disabled={!!activeSession}>
              Créer une room
            </button>
          </div>
        </div>

        <div className="rooms-grid">
          {loadingRooms ? (
            <div className="no-rooms">Chargement des rooms...</div>
          ) : rooms.length === 0 ? (
            <div className="no-rooms">Aucune room ouverte. Créez-en une !</div>
          ) : (
            rooms.map((room) => (
              <div key={room.id} className="room-card">
                <div className="room-info">
                  <span className="room-host">{room.p1.username}</span>
                  <span className="room-date">{new Date(room.createdAt).toLocaleTimeString()}</span>
                </div>
                <button
                  className="room-join-btn"
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={room.player1Id === player?.id || !!activeSession}
                >
                  {room.player1Id === player?.id ? 'Votre room' : 'Rejoindre'}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <nav className="lobby-nav-grid">
        <button className="lobby-nav-card farming" onClick={() => navigate('/farming')}>
          <div className="nav-card-icon">🌲</div>
          <div className="nav-card-content">
            <span className="nav-card-title">Farming</span>
            <span className="nav-card-desc">Récoltez des ressources</span>
          </div>
        </button>

        <button className="lobby-nav-card inventory" onClick={() => navigate('/inventory')}>
          <div className="nav-card-icon">🎒</div>
          <div className="nav-card-content">
            <span className="nav-card-title">Inventaire</span>
            <span className="nav-card-desc">Gérez votre équipement</span>
          </div>
        </button>

        <button className="lobby-nav-card shop" onClick={() => navigate('/shop')}>
          <div className="nav-card-icon">🏪</div>
          <div className="nav-card-content">
            <span className="nav-card-title">Shop</span>
            <span className="nav-card-desc">Achetez des équipements</span>
          </div>
        </button>

        <button className="lobby-nav-card debug" onClick={() => navigate('/debug')}>
          <div className="nav-card-icon">🛠️</div>
          <div className="nav-card-content">
            <span className="nav-card-title">Debug</span>
            <span className="nav-card-desc">Tests techniques</span>
          </div>
        </button>
      </nav>
    </div>
  );
}

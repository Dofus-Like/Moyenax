import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { combatApi } from '../api/combat.api';
import { SKINS, getSkinById } from '../game/constants/skins';
import './LobbyPage.css';

interface Room {
  id: string;
  player1Id: string;
  player1: {
    username: string;
  };
  createdAt: string;
}


export function LobbyPage() {
  const { player, logout, initialize, setSkin } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(true);

  const fetchRooms = React.useCallback(async () => {
    try {
      const res = await combatApi.getRooms();
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
          const res = await combatApi.createRoom();
          const sessionId = res.data.id;
          fetchRooms();
          
          const token = localStorage.getItem('token');
          const eventSource = new EventSource(`${window.location.origin}/api/v1/combat/session/${sessionId}/events?token=${token}`);
          
          eventSource.addEventListener('STATE_UPDATED', () => {
              console.log('Room joined! Navigating to combat page...');
              eventSource.close();
              navigate(`/combat/${sessionId}`);
          });

          // Indiquer à l'utilisateur qu'on attend
          setRooms(prev => [{
              id: sessionId as string,
              player1: { username: 'Vous (En attente...)' },
              player1Id: player?.id ?? '',
              createdAt: new Date().toISOString()
          }, ...prev]);
      } catch (err) {
          console.error('Failed to create room', err);
      }
  };

  const handleJoinRoom = async (sessionId: string) => {
      try {
          const response = await combatApi.acceptChallenge(sessionId);
          navigate(`/combat/${response.data.sessionId}`);
      } catch (err) {
          console.error('Failed to join room', err);
      }
  };


  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <h1>⚔️ Lobby</h1>
        <div className="lobby-user-info">
          <span className="lobby-gold">💰 {player?.gold ?? 0} or</span>
          <div className="user-profile-summary">
            <span className="lobby-username">{player?.username ?? 'Joueur'}</span>
            <span className="lobby-skin-tag">{getSkinById(player?.skin || 'soldier-classic').name}</span>
          </div>
          <button className="lobby-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </header>

      {/* SECTION CHOIX DU SKIN */}
      <section className="lobby-skins">
        <div className="lobby-section-header">
          <h2>🎭 Choisissez votre Apparence</h2>
        </div>
        <div className="skins-grid">
           {SKINS.map(skin => (
             <div 
                key={skin.id} 
                className={`skin-card ${player?.skin === skin.id ? 'active' : ''}`}
                onClick={() => setSkin(skin.id)}
             >
                <div className="skin-preview-container">
                  <div 
                    className={`skin-sprite-icon type-${skin.type}`} 
                    style={{ 
                      filter: `hue-rotate(${skin.hue}deg) saturate(${skin.saturation})`,
                      backgroundImage: `url(/assets/sprites/${skin.type}/idle.png)`,
                      backgroundSize: '600% 100%',
                      backgroundPosition: '0% 0%'
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

      <section className="lobby-combat">
        <div className="lobby-section-header">
          <h2>⚔️ Combat Tactique</h2>
          <div className="lobby-combat-actions">
            <button className="lobby-btn action" onClick={handleCreateRoom}>Créer une Room</button>
          </div>
        </div>

        <div className="rooms-grid">
          {loadingRooms ? (
              <div className="no-rooms">Chargement des rooms...</div>
          ) : rooms.length === 0 ? (
            <div className="no-rooms">Aucune room ouverte. Créez-en une !</div>
          ) : (
            rooms.map(room => (
              <div key={room.id} className="room-card">
                <div className="room-info">
                    <span className="room-host">Hôte: {room.player1.username}</span>
                    <span className="room-date">{new Date(room.createdAt).toLocaleTimeString()}</span>
                </div>
                <button 
                    className="room-join-btn" 
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={room.player1Id === player?.id}
                >
                    {room.player1Id === player?.id ? 'Votre Room' : 'Rejoindre'}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <nav className="lobby-nav">
        <button className="lobby-nav-card" onClick={() => navigate('/farming')}>
          <span className="lobby-nav-icon">🗺️</span>
          <span className="lobby-nav-title">Aventure</span>
          <span className="lobby-nav-desc">Récoltez des ressources</span>
        </button>

        <button className="lobby-nav-card" onClick={() => navigate('/shop')}>
          <span className="lobby-nav-icon">🛒</span>
          <span className="lobby-nav-title">Boutique</span>
          <span className="lobby-nav-desc">Achetez et vendez</span>
        </button>

        <button className="lobby-nav-card" onClick={() => navigate('/crafting')}>
          <span className="lobby-nav-icon">🔨</span>
          <span className="lobby-nav-title">Atelier</span>
          <span className="lobby-nav-desc">Craft et Fusion</span>
        </button>

        <button className="lobby-nav-card" onClick={() => navigate('/inventory')}>
          <span className="lobby-nav-icon">🎒</span>
          <span className="lobby-nav-title">Inventaire</span>
          <span className="lobby-nav-desc">Gérez votre équipement</span>
        </button>

        <button className="lobby-nav-card debug" onClick={() => navigate('/debug')}>
          <span className="lobby-nav-icon">🛠️</span>
          <span className="lobby-nav-title">Debug</span>
        </button>
      </nav>
    </div>
  );
}

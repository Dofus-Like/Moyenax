import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { combatApi } from '../api/combat.api';
import './LobbyPage.css';

export function LobbyPage() {
  const { player, logout, initialize } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = React.useState<any[]>([]);
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
          
          eventSource.addEventListener('STATE_UPDATED', (e) => {
              console.log('Room joined! Navigating to combat page...');
              eventSource.close();
              navigate(`/combat/${sessionId}`);
          });

          // Indiquer à l'utilisateur qu'on attend
          setRooms(prev => [{
              id: sessionId,
              player1: { username: 'Vous (En attente...)' },
              player1Id: player?.id,
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

  const handleStartTestCombat = async () => {
    try {
      const response = await combatApi.startTestCombat();
      const sessionId = response.data.sessionId;
      navigate(`/combat/${sessionId}`);
    } catch (err) {
      console.error('Failed to start test combat', err);
      alert('Erreur: Assurez-vous d\'avoir lancé le seed (yarn setup).');
    }
  };

  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <h1>⚔️ Lobby</h1>
        <div className="lobby-user-info">
          <span className="lobby-gold">💰 {player?.gold ?? 0} or</span>
          <span className="lobby-username">{player?.username ?? 'Joueur'}</span>
          <button className="lobby-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </header>

      <section className="lobby-combat">
        <div className="lobby-section-header">
          <h2>⚔️ Combat Tactique</h2>
          <div className="lobby-combat-actions">
            <button className="lobby-btn action" onClick={handleCreateRoom}>Créer une Room</button>
            <button className="lobby-btn secondary" onClick={handleStartTestCombat}>Test vs IA</button>
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
          <span className="lobby-nav-title">Mode Farming</span>
          <span className="lobby-nav-desc">Récoltez des ressources sur la carte</span>
        </button>

        <button className="lobby-nav-card" onClick={() => navigate('/shop')}>
          <span className="lobby-nav-icon">🏪</span>
          <span className="lobby-nav-title">Boutique</span>
          <span className="lobby-nav-desc">Achetez et vendez des objets</span>
        </button>

        <button className="lobby-nav-card" onClick={() => navigate('/inventory')}>
          <span className="lobby-nav-icon">🎒</span>
          <span className="lobby-nav-title">Inventaire</span>
          <span className="lobby-nav-desc">Gérez votre équipement</span>
        </button>

        <button className="lobby-nav-card" onClick={() => navigate('/debug')}>
          <span className="lobby-nav-icon">🛠️</span>
          <span className="lobby-nav-title">Debug Panel</span>
          <span className="lobby-nav-desc">Testez combat et farming séparément</span>
        </button>
      </nav>
    </div>
  );
}

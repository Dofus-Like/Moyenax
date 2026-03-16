import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import './LobbyPage.css';

export function LobbyPage() {
  const { player, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
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

      <nav className="lobby-nav">
        <button className="lobby-nav-card" onClick={() => navigate('/map')}>
          <span className="lobby-nav-icon">🗺️</span>
          <span className="lobby-nav-title">Carte des Ressources</span>
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

        <button className="lobby-nav-card combat" onClick={() => navigate('/combat/new')}>
          <span className="lobby-nav-icon">⚔️</span>
          <span className="lobby-nav-title">Combat</span>
          <span className="lobby-nav-desc">Défiez d'autres joueurs</span>
        </button>
      </nav>
    </div>
  );
}

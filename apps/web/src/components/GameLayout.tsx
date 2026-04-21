import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useGameSession } from '../pages/GameTunnel';
import { getSessionPo } from '../utils/sessionPo';
import './GameLayout.css';

export function GameLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isDebugMode = searchParams.get('debug') === 'true';
  const tunnelQuery = isDebugMode ? '?debug=true' : '';
  
  const { player, logout } = useAuthStore();
  const { activeSession } = useGameSession();

  const spendableGold = activeSession 
    ? (getSessionPo(activeSession, player?.id) ?? 0) 
    : (player?.gold ?? 0);

  const navItems = [
    { label: '🏛️ Lobby', path: '/' },
    { label: '⚔️ Combat', path: '/farming' },
    { label: '💰 Boutique', path: '/shop' },
    { label: '🎒 Sac', path: '/inventory' },
    { label: '🔨 Forge', path: '/crafting' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`game-layout ${location.pathname === '/' ? 'in-lobby' : ''}`}>
      {location.pathname !== '/' && (
        <nav className="game-navbar">
          <div className="nav-logo" onClick={() => navigate('/')}>
            ⚔️ Moyenax
          </div>
          
          <div className="nav-links">
            {navItems.map((item) => (
              <button
                key={item.path}
                className={`nav-btn ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(`${item.path}${tunnelQuery}`)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="nav-user-info">
            <div className="user-stats">
              <span className="user-gold">💰 {spendableGold}</span>
              <span className="user-name">{player?.username}</span>
            </div>
            <button className="nav-logout-btn" onClick={handleLogout}>
              🚪
            </button>
          </div>
        </nav>
      )}
      
      <main className="game-content">
        {children}
      </main>
    </div>
  );
}

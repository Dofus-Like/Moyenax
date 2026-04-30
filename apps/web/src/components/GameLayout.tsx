import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

import { getSkinById } from '../game/constants/skins';
import { useGameSession } from '../pages/GameTunnel';
import { useAuthStore } from '../store/auth.store';
import { getSessionPo } from '../utils/sessionPo';

import { GlobalBackground } from './GlobalBackground';
import './GameLayout.css';

const CLASS_META: Record<'soldier' | 'orc', { label: string; color: string }> = {
  soldier: { label: 'Guerrier', color: '#60a5fa' },
  orc: { label: 'Berserk', color: '#4ade80' },
};

export function GameLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isDebugMode = searchParams.get('debug') === 'true';
  const tunnelQuery = isDebugMode ? '?debug=true' : '';
  
  const { player, logout } = useAuthStore();
  const { activeSession } = useGameSession();

  const isCombatPage = location.pathname.startsWith('/combat');

  const spendableGold = activeSession 
    ? (getSessionPo(activeSession, player?.id) ?? 0) 
    : (player?.gold ?? 0);

  const navItems = [
    { label: 'Lobby', path: '/' },
    {
      label: (location.pathname === '/farming' || (activeSession?.phase === 'FARMING')) ? 'Récolte' : 'Combat',
      path: '/farming',
    },
    { label: 'Boutique', path: '/shop' },
    { label: 'Inventaire', path: '/inventory' },
    { label: 'Forge', path: '/crafting' },
  ];

  const activeSkin = player?.skin ? getSkinById(player.skin) : null;
  const classInfo = activeSkin ? CLASS_META[activeSkin.type] : null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`game-layout ${location.pathname === '/' ? 'in-lobby' : ''}`}>
      {!isCombatPage && <GlobalBackground />}
      
      <nav className="game-navbar">
        <div className="nav-logo" onClick={() => navigate('/')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14.5 2.5 21 9 9 21l-3 .5.5-3L14.5 2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M5 19l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
            <path d="M15.5 5.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".5" />
          </svg>
          <span>Moyenax</span>
        </div>

        {location.pathname !== '/' && (
          <div className="nav-links">
            {navItems
              .filter(item => item.path !== '/')
              .map((item) => (
                <button
                  key={item.path}
                  className={`nav-btn ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => navigate(`${item.path}${tunnelQuery}`)}
                >
                  {item.label}
                </button>
              ))}
          </div>
        )}

        <div className="nav-user-info">
          <div className="user-stats">
            {classInfo && (
              <span
                className="nav-class-chip"
                style={{ color: classInfo.color, borderColor: `${classInfo.color}50`, background: `${classInfo.color}18` }}
              >
                {classInfo.label}
              </span>
            )}
            {activeSession && <span className="user-gold">💰 {spendableGold}</span>}
            <span className="user-name">{player?.username}</span>
          </div>
          <button className="nav-logout-btn" onClick={handleLogout} title="Se déconnecter">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </nav>
      
      <main className="game-content">
        {children}
      </main>
    </div>
  );
}

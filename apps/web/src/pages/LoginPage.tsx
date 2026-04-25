import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import './LoginPage.css';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setToken, setPlayer } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      let response;
      if (isRegister) {
        response = await authApi.register({ username, email, password });
      } else {
        response = await authApi.login({ email, password });
      }

      setToken(response.data.accessToken);

      const me = await authApi.getMe();
      setPlayer(me.data);

      navigate('/');
    } catch {
      setError('Erreur d\'authentification. Vérifiez vos identifiants.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">⚔️ Moyenax</h1>
        <p className="login-subtitle">Jeu de stratégie au tour par tour</p>

        <div className="login-tabs">
          <button
            className={`login-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => setIsRegister(false)}
          >
            Connexion
          </button>
          <button
            className={`login-tab ${isRegister ? 'active' : ''}`}
            onClick={() => setIsRegister(true)}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <input
              type="text"
              placeholder="Pseudo"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              required
              minLength={3}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            required
            minLength={8}
          />

          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-button">
            {isRegister ? 'Créer un compte' : 'Se connecter'}
          </button>
        </form>

        {!isRegister && (
            <div className="quick-login">
                <p className="quick-login-title">⚡ Test: Connexion Rapide</p>
                <div className="quick-login-buttons">
                    {[
                        { name: 'Warrior', emoji: '🛡️', email: 'warrior@test.com', class: 'warrior' },
                        { name: 'Mage', emoji: '🧙', email: 'mage@test.com', class: 'mage' },
                        { name: 'Ninja', emoji: '🥷', email: 'ninja@test.com', class: 'ninja' },
                        { name: 'Troll', emoji: '👺', email: 'troll@test.com', class: 'troll' },
                    ].map(user => (
                        <button 
                            key={user.email}
                            type="button"
                            className={`quick-btn ${user.class}`}
                            onClick={async () => {
                                try {
                                    const res = await authApi.login({ email: user.email, password: 'password123' });
                                    setToken(res.data.accessToken);
                                    const me = await authApi.getMe();
                                    setPlayer(me.data);
                                    navigate('/');
                                } catch (e) { 
                                    console.error('Quick login error:', e);
                                    setError('Seed non effectuée ou API hors ligne ?'); 
                                }
                            }}
                        >
                            {user.emoji} {user.name}
                        </button>
                    ))}
                </div>
                <p className="quick-login-tip">💡 Pour jouer à deux, utilisez un <strong>onglet navigation privée</strong> pour la 2ème instance.</p>
            </div>
        )}
      </div>
    </div>
  );
}

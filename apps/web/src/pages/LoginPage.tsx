import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import { RetroWindow } from '../components/retro/RetroWindow';
import { RetroMarquee } from '../components/retro/RetroMarquee';
import { ThemeToggle } from '../components/ThemeToggle';
import './LoginPage.css';
import './LoginPage.retro.css';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClass, setSelectedClass] = useState('warrior');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setToken, setPlayer } = useAuthStore();
  const isRetro = useThemeStore((s) => s.theme) === 'retro';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      let response;
      if (isRegister) {
        response = await authApi.register({ username, email, password, selectedClass });
      } else {
        response = await authApi.login({ email, password });
      }

      setToken(response.data.accessToken);

      const me = await authApi.getMe();
      setPlayer(me.data);

      navigate('/');
    } catch (err) {
      setError('Erreur d\'authentification. Vérifiez vos identifiants.');
    }
  };

  const formContent = (
    <>
      <h1 className={`login-title ${isRetro ? 'text-rainbow' : ''}`}>
        {isRetro ? 'Moyenax' : '⚔️ Moyenax'}
      </h1>
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

        {isRegister && (
          <div className="class-selector">
            <p className="selector-title">Choisis ta classe :</p>
            <div className="class-options">
              {[
                { id: 'warrior', name: 'Guerrier', emoji: '🛡️', desc: 'HP+ et Dégâts Physiques' },
                { id: 'mage', name: 'Mage', emoji: '🧙', desc: 'Portée et Sorts Utiles' },
                { id: 'ninja', name: 'Ninja', emoji: '🥷', desc: 'Mobilité et Initiative' }
              ].map(cls => (
                <div 
                  key={cls.id}
                  className={`class-option ${selectedClass === cls.id ? 'active' : ''}`}
                  onClick={() => setSelectedClass(cls.id)}
                >
                  <span className="class-emoji">{cls.emoji}</span>
                  <div className="class-info">
                    <strong>{cls.name}</strong>
                    <small>{cls.desc}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="login-button">
          {isRegister ? 'Créer un compte' : 'Se connecter'}
        </button>
      </form>

      {!isRegister && (
        <div className="quick-login">
          {isRetro && <hr className="hr-groove" />}
          <p className="quick-login-title">{isRetro ? '' : '⚡ '}Test: Connexion Rapide</p>
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
          <p className="quick-login-tip">
            {isRetro ? '' : '💡 '}Pour jouer à deux, utilisez un <strong>onglet navigation privée</strong> pour la 2ème instance.
          </p>
        </div>
      )}
    </>
  );

  return (
    <div className="login-container">
      {isRetro && (
        <RetroMarquee>
          <span style={{ color: '#ffff00', fontWeight: 700 }}>*** BIENVENUE SUR MOYENAX ***</span>
          <span style={{ color: '#00ff00', fontWeight: 700 }}>Jeu de stratégie au tour par tour</span>
          <span style={{ color: '#ff0000', fontWeight: 700 }}>Combattez ! Farmez ! Craftez !</span>
          <span style={{ color: '#ffffff', fontWeight: 700 }}>*** BIENVENUE SUR MOYENAX ***</span>
        </RetroMarquee>
      )}

      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>

      {isRetro ? (
        <div style={{ marginTop: 32 }}>
          <RetroWindow title="Moyenax - Connexion" className="login-card">
            {formContent}
          </RetroWindow>
        </div>
      ) : (
        <div className="login-card">
          {formContent}
        </div>
      )}

      {isRetro && (
        <div className="hit-counter" style={{ marginTop: 24 }}>
          Visiteurs: 001337 | Depuis 1997
        </div>
      )}
    </div>
  );
}

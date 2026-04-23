import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useCombatStore } from '../store/combat.store';
import { useFarmingStore } from '../store/farming.store';
import { combatApi } from '../api/combat.api';
import { mapApi } from '../api/map.api';
import { ALL_SEED_IDS, SEED_CONFIGS, SeedId } from '@game/shared-types';
import './DebugPage.css';

export function DebugPage() {
  const navigate = useNavigate();
  const player = useAuthStore((s) => s.player);
  const combatState = useCombatStore((s) => s.combatState);
  const sessionId = useCombatStore((s) => s.sessionId);
  const sseConnection = useCombatStore((s) => s.sseConnection);
  const farmingInventory = useFarmingStore((s) => s.inventory);
  const farmingPos = useFarmingStore((s) => s.playerPosition);
  const resetFarming = useFarmingStore((s) => s.reset);

  const [selectedSeed, setSelectedSeed] = useState<SeedId | undefined>();
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string>('');

  const handleStartTestCombat = useCallback(async () => {
    setLoading('combat');
    try {
      const response = await combatApi.startTestCombat();
      const sid = response.data.sessionId;
      setLastResult(`Combat cree: ${sid}`);
      navigate(`/combat/${sid}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setLastResult(`Erreur combat: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(null);
    }
  }, [navigate]);

  const handleStartFarming = useCallback(async () => {
    setLoading('farming');
    try {
      resetFarming();
      const map = await mapApi.generateNew(selectedSeed);
      setLastResult(`Map generee: seed=${map.seedId}, ${map.width}x${map.height}`);
      navigate('/farming?debug=true');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setLastResult(`Erreur farming: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(null);
    }
  }, [navigate, selectedSeed, resetFarming]);

  const handleResetMap = useCallback(async () => {
    setLoading('reset');
    try {
      const map = await mapApi.generateNew(selectedSeed);
      setLastResult(`Map reset: seed=${map.seedId}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setLastResult(`Erreur reset: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(null);
    }
  }, [selectedSeed]);

  return (
    <div className="debug-container">
      <header className="debug-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="back-button" onClick={() => navigate('/')}>
            Retour Lobby
          </button>
          <h1>Debug Panel</h1>
        </div>
        {player && (
          <div className="debug-user-badge">
            <span>{player.username}</span>
            <code>{player.id}</code>
          </div>
        )}
      </header>

      <div className="debug-grid">
        {/* Combat Test */}
        <div className="debug-card">
          <h2>Combat</h2>
          <p>Lancer un combat test contre le joueur "Mage" du seed.</p>
          <div className="debug-actions">
            <button
              className="debug-btn primary"
              onClick={handleStartTestCombat}
              disabled={loading === 'combat'}
            >
              {loading === 'combat' ? 'Lancement...' : 'Lancer Combat Test'}
            </button>
          </div>
          {sessionId && (
            <div style={{ marginTop: 12 }}>
              <div className="debug-status">
                <div className={`debug-status-dot ${sseConnection ? 'connected' : ''}`} />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  SSE {sseConnection ? 'connecte' : 'deconnecte'}
                </span>
              </div>
              <button
                className="debug-btn secondary"
                onClick={() => navigate(`/combat/${sessionId}`)}
                style={{ marginTop: 4 }}
              >
                Rejoindre session {sessionId.slice(0, 8)}...
              </button>
            </div>
          )}
        </div>

        {/* Farming Test */}
        <div className="debug-card">
          <h2>Farming</h2>
          <p>Generer une map et lancer le mode farming.</p>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Seed :</span>
            <div className="seed-selector">
              <button
                className={`seed-chip ${!selectedSeed ? 'active' : ''}`}
                onClick={() => setSelectedSeed(undefined)}
              >
                Random
              </button>
              {ALL_SEED_IDS.map((sid) => (
                <button
                  key={sid}
                  className={`seed-chip ${selectedSeed === sid ? 'active' : ''}`}
                  onClick={() => setSelectedSeed(sid)}
                  title={SEED_CONFIGS[sid].dominantBuild}
                >
                  {SEED_CONFIGS[sid].label}
                </button>
              ))}
            </div>
          </div>
          <div className="debug-actions">
            <button
              className="debug-btn success"
              onClick={handleStartFarming}
              disabled={loading === 'farming'}
            >
              {loading === 'farming' ? 'Chargement...' : 'Lancer Farming'}
            </button>
            <button
              className="debug-btn secondary"
              onClick={handleResetMap}
              disabled={loading === 'reset'}
            >
              Reset Map
            </button>
            <button
              className="debug-btn danger"
              onClick={() => {
                resetFarming();
                setLastResult('Inventaire farming reset');
              }}
            >
              Reset Inventaire
            </button>
          </div>
        </div>

        {/* Navigation rapide */}
        <div className="debug-card">
          <h2>Navigation Rapide</h2>
          <div className="debug-actions">
            <button className="debug-btn secondary" onClick={() => navigate('/')}>
              Lobby
            </button>
            <button className="debug-btn secondary" onClick={() => navigate('/farming')}>
              Farming
            </button>
            <button className="debug-btn secondary" onClick={() => navigate('/shop')}>
              Boutique
            </button>
            <button className="debug-btn secondary" onClick={() => navigate('/inventory')}>
              Inventaire
            </button>
            <button
              className="debug-btn secondary"
              onClick={() => navigate('/crafting?debug=true')}
            >
              Forge (craft)
            </button>
          </div>
        </div>

        {/* Inventaire Farming */}
        <div className="debug-card">
          <h2>Farming State</h2>
          <div
            style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}
          >
            Position: {farmingPos ? `(${farmingPos.x}, ${farmingPos.y})` : 'non definie'}
          </div>
          <div className="debug-json">
            {Object.keys(farmingInventory).length === 0
              ? 'Inventaire vide'
              : JSON.stringify(farmingInventory, null, 2)}
          </div>
        </div>

        {/* Etat global */}
        <div className="debug-card debug-state-panel">
          <h2>Etat Combat (JSON)</h2>
          {lastResult && (
            <div
              style={{
                padding: '8px 12px',
                marginBottom: 12,
                borderRadius: 'var(--radius)',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid var(--color-primary)',
                fontSize: '0.8rem',
              }}
            >
              {lastResult}
            </div>
          )}
          <div className="debug-json">
            {combatState ? JSON.stringify(combatState, null, 2) : 'Aucun combat en cours'}
          </div>
        </div>
      </div>
    </div>
  );
}

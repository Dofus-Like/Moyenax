import React from 'react';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { combatApi } from '../../api/combat.api';
import { CombatActionType } from '@game/shared-types';
import './CombatHUD.css';

export function CombatHUD() {
  const combatState = useCombatStore((s) => s.combatState);
  const sessionId = useCombatStore((s) => s.sessionId);
  const selectedSpellId = useCombatStore((s) => s.selectedSpellId);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  const setCombatState = useCombatStore((s) => s.setCombatState);
  const logs = useCombatStore((s) => s.logs);
  
  const user = useAuthStore((s) => s.player);

  const currentPlayer = (combatState && user) ? combatState.players[user.id] : null;
  const isMyTurn = (combatState && user) ? combatState.currentTurnPlayerId === user.id : false;

  console.log('CombatHUD: Debug', {
    userId: user?.id,
    playerIds: combatState ? Object.keys(combatState.players) : [],
    hasCurrentPlayer: !!currentPlayer,
    isMyTurn,
    currentTurnPlayerId: combatState?.currentTurnPlayerId
  });

  if (!combatState || !user) return null;
  if (!currentPlayer) {
    return (
      <div className="combat-hud-error" style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(220, 38, 38, 0.8)', padding: '10px 20px', borderRadius: '8px', color: 'white', zIndex: 1000 }}>
        Erreur: Joueur non trouvé dans le combat. 
        ID: {user.id} <br/> 
        Disponibles: {Object.keys(combatState.players).join(', ')}
      </div>
    );
  }

  const handleEndTurn = async () => {
    if (!sessionId) return;
    
    try {
      let res;
      if (isMyTurn) {
        console.log('CombatHUD: Ending turn for player', user.id);
        res = await combatApi.playAction(sessionId, { type: CombatActionType.END_TURN });
      } else {
        console.log('CombatHUD: Forcing end turn for opponent', combatState.currentTurnPlayerId);
        res = await combatApi.forcePlayAction(sessionId, combatState.currentTurnPlayerId, { 
          type: CombatActionType.END_TURN 
        });
      }
      
      if (res?.data) {
        setCombatState(res.data);
      }
      setSelectedSpell(null);
    } catch (err: any) {
      console.error('CombatHUD: End turn failed', err);
      const msg = err.response?.data?.message || err.message;
      alert(`Erreur: ${msg}`);
    }
  };

  const hpPercent = (currentPlayer.currentVit / currentPlayer.stats.vit) * 100;

  return (
    <div className="combat-hud">
      <div className="hud-stats">
        <div className="hud-hp">
          <span className="hud-label">VIT</span>
          <div className="hud-bar">
            <div className="hud-bar-fill hp" style={{ width: `${Math.max(0, hpPercent)}%` }} />
          </div>
          <span className="hud-value">{currentPlayer.currentVit}/{currentPlayer.stats.vit}</span>
        </div>

        <div className="hud-points">
          <span className="hud-pa">⚡ PA: {currentPlayer.remainingPa}/{currentPlayer.stats.pa}</span>
          <span className="hud-pm">🦶 PM: {currentPlayer.remainingPm}/{currentPlayer.stats.pm}</span>
        </div>
      </div>

      {selectedSpellId && (
          <div className="hud-selected-spell-info">
              {(() => {
                  const spell = currentPlayer.spells.find(s => s.id === selectedSpellId);
                  if (!spell) return null;
                  return (
                      <>
                        <strong>{spell.name}</strong> • Range: {spell.minRange}-{spell.maxRange} • Damage: {spell.damage.min}-{spell.damage.max}
                        <p className="hud-hint">Cliquez sur une cible pour lancer le sort</p>
                      </>
                  );
              })()}
          </div>
      )}

      <div className="hud-spells">
        {currentPlayer.spells.map((spell) => {
          const onCooldown = (currentPlayer.spellCooldowns[spell.id] ?? 0) > 0;
          const notEnoughPa = currentPlayer.remainingPa < spell.paCost;
          const isActive = selectedSpellId === spell.id;
          const disabled = !isMyTurn || onCooldown || notEnoughPa;

          return (
            <button
              key={spell.id}
              className={`hud-spell-btn ${disabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => setSelectedSpell(isActive ? null : spell.id)}
              title={`${spell.name} (${spell.paCost} PA)`}
            >
              <span className="spell-name">{spell.name}</span>
              <span className="spell-cost">{spell.paCost} PA</span>
              {onCooldown && (
                <span className="spell-cooldown">{currentPlayer.spellCooldowns[spell.id]}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="hud-actions">
        <div className="hud-logs">
          {logs.map((log) => (
            <div key={log.id} className={`hud-log ${log.type}`}>
              {log.message}
            </div>
          ))}
        </div>

        <div className="hud-actions-right">
          <span className={`hud-turn-indicator ${isMyTurn ? 'my-turn' : ''}`}>
            {isMyTurn ? '⚔️ Votre tour' : '⏳ Attente adversaire'}
          </span>
          <button
            className="hud-end-turn"
            onClick={handleEndTurn}
          >
            {isMyTurn ? 'Fin de tour' : 'Forcer Fin Adv.'}
          </button>
        </div>
      </div>
    </div>
  );
}

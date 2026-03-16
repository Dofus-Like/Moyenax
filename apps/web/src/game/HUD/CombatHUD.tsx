import React from 'react';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { combatApi } from '../../api/combat.api';
import { CombatActionType } from '@game/shared-types';
import './CombatHUD.css';

export function CombatHUD() {
  const combatState = useCombatStore((s) => s.combatState);
  const sessionId = useCombatStore((s) => s.sessionId);
  const player = useAuthStore((s) => s.player);

  if (!combatState || !player) return null;

  const currentPlayer = combatState.players[player.id];
  if (!currentPlayer) return null;

  const isMyTurn = combatState.currentTurnPlayerId === player.id;

  const handleEndTurn = async () => {
    if (!sessionId || !isMyTurn) return;
    await combatApi.playAction(sessionId, { type: CombatActionType.END_TURN });
  };

  const hpPercent = (currentPlayer.stats.hp / currentPlayer.stats.maxHp) * 100;

  return (
    <div className="combat-hud">
      <div className="hud-stats">
        <div className="hud-hp">
          <span className="hud-label">HP</span>
          <div className="hud-bar">
            <div className="hud-bar-fill hp" style={{ width: `${hpPercent}%` }} />
          </div>
          <span className="hud-value">{currentPlayer.stats.hp}/{currentPlayer.stats.maxHp}</span>
        </div>

        <div className="hud-points">
          <span className="hud-ap">⚡ PA: {currentPlayer.remainingAp}/{currentPlayer.stats.maxAp}</span>
          <span className="hud-mp">🦶 PM: {currentPlayer.remainingMp}/{currentPlayer.stats.maxMp}</span>
        </div>
      </div>

      <div className="hud-spells">
        {currentPlayer.spells.map((spell) => {
          const onCooldown = (currentPlayer.spellCooldowns[spell.id] ?? 0) > 0;
          const notEnoughAp = currentPlayer.remainingAp < spell.apCost;
          const disabled = !isMyTurn || onCooldown || notEnoughAp;

          return (
            <button
              key={spell.id}
              className={`hud-spell-btn ${disabled ? 'disabled' : ''}`}
              disabled={disabled}
              title={`${spell.name} (${spell.apCost} PA)`}
            >
              <span className="spell-name">{spell.name}</span>
              <span className="spell-cost">{spell.apCost} PA</span>
              {onCooldown && (
                <span className="spell-cooldown">{currentPlayer.spellCooldowns[spell.id]} tours</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="hud-actions">
        <span className={`hud-turn-indicator ${isMyTurn ? 'my-turn' : ''}`}>
          {isMyTurn ? '🟢 Votre tour' : '🔴 Tour adverse'}
        </span>
        <button
          className="hud-end-turn"
          onClick={handleEndTurn}
          disabled={!isMyTurn}
        >
          Fin de tour
        </button>
      </div>
    </div>
  );
}

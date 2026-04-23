import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { useGameSession } from '../../pages/GameTunnel';
import { combatApi } from '../../api/combat.api';
import { CombatActionType, SpellFamily } from '@game/shared-types';
import { getSkinById } from '../../game/constants/skins';
import { PlayerAvatar } from '../../components/Player/PlayerAvatar';
import { CombatMannequins } from './CombatMannequins';
import './CombatUIManager.css';

const SPELL_FAMILY_ORDER: Record<SpellFamily, number> = {
  [SpellFamily.COMMON]: 1,
  [SpellFamily.WARRIOR]: 2,
  [SpellFamily.MAGE]: 3,
  [SpellFamily.NINJA]: 4,
};

export function CombatUIManager() {
  const combatState = useCombatStore((s) => s.combatState);
  const sessionId = useCombatStore((s) => s.sessionId);
  const selectedSpellId = useCombatStore((s) => s.selectedSpellId);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  const setCombatState = useCombatStore((s) => s.setCombatState);
  const winnerId = useCombatStore((s) => s.winnerId);
  const showEnemyHp = useCombatStore((s) => s.showEnemyHp);
  const toggleShowEnemyHp = useCombatStore((s) => s.toggleShowEnemyHp);
  const surrender = useCombatStore((s) => s.surrender);
  const disconnect = useCombatStore((s) => s.disconnect);
  const uiMessage = useCombatStore((s) => s.uiMessage);

  const [showMannequins, setShowMannequins] = useState(false);
  const user = useAuthStore((s) => s.player);
  const navigate = useNavigate();

  const currentPlayer = combatState && user ? combatState.players[user.id] : null;
  const isMyTurn = combatState && user ? combatState.currentTurnPlayerId === user.id : false;

  const [isClosing, setIsClosing] = useState(false);
  const turnRef = useRef(isMyTurn);

  useEffect(() => {
    if (turnRef.current && !isMyTurn) {
      setIsClosing(true);
      const timer = setTimeout(() => setIsClosing(false), 450);
      return () => clearTimeout(timer);
    }
    turnRef.current = isMyTurn;
  }, [isMyTurn]);

  if (!combatState || !user || !currentPlayer) return null;

  const isWinner = winnerId === user.id;
  const showCombatEnd = !!winnerId;

  const sortedSpells = [...currentPlayer.spells].sort((a, b) => {
    const familyOrder = SPELL_FAMILY_ORDER[a.family] - SPELL_FAMILY_ORDER[b.family];
    if (familyOrder !== 0) return familyOrder;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });

  const handleEndTurn = async () => {
    if (!sessionId || !isMyTurn) return;
    try {
      const res = await combatApi.playAction(sessionId, { type: CombatActionType.END_TURN });
      if (res?.data) setCombatState(res.data);
      setSelectedSpell(null);
    } catch (err) {
      console.error('End turn failed', err);
    }
  };

  const hpPercent = (currentPlayer.currentVit / (currentPlayer.stats?.vit || 1)) * 100;

  return (
    <div className="combat-ui-manager">
      {/* Notifications */}
      {uiMessage && <div className={`combat-toast ${uiMessage.type}`}>{uiMessage.text}</div>}

      {/* Victoire/Défaite */}
      {showCombatEnd && (
        <div className={`combat-end-overlay ${isWinner ? 'victory' : 'defeat'}`}>
          <div className="end-modal">
            <h1>{isWinner ? '🏆 VICTOIRE' : '💀 DÉFAITE'}</h1>
            <p>{isWinner ? 'Bravo !' : 'Dommage...'}</p>
            <button
              className="exit-button"
              onClick={() => {
                disconnect();
                navigate('/');
              }}
            >
              Retour
            </button>
          </div>
        </div>
      )}

      {/* ZONE TOP : Portrait & Mannequins */}
      <div className="ui-top-zone">
        <div className="ui-player-corner">
          <div className="portrait-block">
            <div className={`portrait-circle ${isMyTurn ? 'active' : ''}`}>
              <PlayerAvatar
                skin={currentPlayer.skin || 'soldier-classic'}
                size={64}
                animation="idle"
              />
            </div>
            <div className="portrait-stats">
              <span className="player-name">{user.username}</span>
              <div className="hp-bar-bg">
                <div className="hp-bar-fill" style={{ width: `${hpPercent}%` }} />
              </div>
              <div className="res-row">
                <div className="res-badge pa">{currentPlayer.remainingPa} PA</div>
                <div className="res-badge pm">{currentPlayer.remainingPm} PM</div>
              </div>
            </div>
            {(isMyTurn || isClosing) && (
              <button
                className={`btn-end-turn ${isClosing ? 'closing' : ''}`}
                onClick={handleEndTurn}
              >
                FIN DE TOUR
              </button>
            )}
          </div>

          <div className="ui-controls">
            <button className="btn-surrender" onClick={() => surrender()}>
              ABANDONNER
            </button>
            <div className="mannequins-control-group">
              <button
                className={`btn-view ${showMannequins ? 'active' : ''}`}
                onClick={() => setShowMannequins(!showMannequins)}
              >
                {showMannequins ? 'Cacher Inventaires' : 'Voir Inventaires'}
              </button>
              <div className={`ui-mannequins-layer-embedded ${showMannequins ? 'visible' : ''}`}>
                <CombatMannequins minimized={!showMannequins} />
              </div>
            </div>
            <button className="btn-eye" onClick={() => toggleShowEnemyHp()}>
              {showEnemyHp ? '👁️' : '🚫'}
            </button>
          </div>
        </div>
      </div>

      {/* ZONE BAS : Barre de sorts */}
      <div className="ui-bottom-zone">
        <div className="spell-bar">
          {sortedSpells.map((spell) => {
            const onCooldown = (currentPlayer.spellCooldowns[spell.id] ?? 0) > 0;
            const notEnoughPa = currentPlayer.remainingPa < spell.paCost;
            const isActive = selectedSpellId === spell.id;
            const disabled = !isMyTurn || onCooldown || notEnoughPa;

            return (
              <div
                key={spell.id}
                className={`spell-slot ${disabled ? 'disabled' : ''} ${isActive ? 'active' : ''} family-${spell.family.toLowerCase()}`}
                onClick={() => !disabled && setSelectedSpell(isActive ? null : spell.id)}
              >
                <div className="spell-cost">{spell.paCost}</div>
                <img src={spell.iconPath || '/assets/pack/spells/epee.png'} alt={spell.name} />
                {onCooldown && (
                  <div className="cooldown-overlay">{currentPlayer.spellCooldowns[spell.id]}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

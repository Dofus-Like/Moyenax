import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { combatApi } from '../../api/combat.api';
import { CombatActionType } from '@game/shared-types';
import { getSkinById } from '../../game/constants/skins';
import './CombatHUD.css';

const SPELL_FAMILIES: Record<string, 'warrior' | 'mage' | 'ninja'> = {
  'spell-frappe': 'warrior',
  'spell-bond': 'warrior',
  'spell-endurance': 'warrior',
  'spell-boule-de-feu': 'mage',
  'spell-menhir': 'mage',
  'spell-soin': 'mage',
  'spell-kunai': 'ninja',
  'spell-bombe-repousse': 'ninja',
  'spell-velocite': 'ninja'
};

const SPELL_ICONS: Record<string, string> = {
  'spell-frappe': '/assets/pack/spells/epee.png',
  'spell-bond': '/assets/pack/spells/bond.png',
  'spell-endurance': '/assets/pack/spells/endurance.png',
  'spell-boule-de-feu': '/assets/pack/spells/fireball.png',
  'spell-menhir': '/assets/pack/spells/menhir.png',
  'spell-soin': '/assets/pack/spells/heal.png',
  'spell-kunai': '/assets/pack/spells/kunai.png',
  'spell-bombe-repousse': '/assets/pack/spells/bombe.png',
  'spell-velocite': '/assets/pack/spells/velocite.png'
};

function getCombatErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function CombatHUD() {
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
  const setUiMessage = useCombatStore((s) => s.setUiMessage);
  const [hoveredSpellId, setHoveredSpellId] = React.useState<string | null>(null);
  const user = useAuthStore((s) => s.player);
  const navigate = useNavigate();

  const currentPlayer = (combatState && user) ? combatState.players[user.id] : null;
  const isMyTurn = (combatState && user) ? combatState.currentTurnPlayerId === user.id : false;

  const skinConfig = React.useMemo(() => {
    return getSkinById(currentPlayer?.skin || 'soldier-classic');
  }, [currentPlayer?.skin]);

  const [isClosing, setIsClosing] = React.useState(false);
  const turnRef = React.useRef(isMyTurn);

  React.useEffect(() => {
    if (turnRef.current && !isMyTurn) {
        setIsClosing(true);
        const timer = setTimeout(() => setIsClosing(false), 450);
        return () => clearTimeout(timer);
    }
    turnRef.current = isMyTurn;
  }, [isMyTurn]);

  React.useEffect(() => {
    if (!uiMessage) return;
    const timer = setTimeout(() => setUiMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [setUiMessage, uiMessage]);

  if (!combatState || !user || !currentPlayer) return null;

  const handleCombatExit = () => {
    disconnect();
    navigate('/');
  };

  const isWinner = winnerId === user.id;
  const showCombatEnd = !!winnerId;

  // Tri par famille
  const sortedSpells = [...currentPlayer.spells].sort((a, b) => {
    const families: Record<string, number> = { warrior: 1, mage: 2, ninja: 3 };
    const famA = families[SPELL_FAMILIES[a.id]] || 99;
    const famB = families[SPELL_FAMILIES[b.id]] || 99;
    return famA - famB;
  });

  const handleEndTurn = async () => {
    if (!sessionId || !isMyTurn) return;
    try {
      const res = await combatApi.playAction(sessionId, { type: CombatActionType.END_TURN });
      if (res?.data) setCombatState(res.data);
      setSelectedSpell(null);
    } catch (err) {
      console.error('CombatHUD: End turn failed', err);
      setUiMessage(getCombatErrorMessage(err, 'Impossible de terminer le tour.'), 'error');
    }
  };

  const hpPercent = (currentPlayer.currentVit / (currentPlayer.stats?.vit || 1)) * 100;
  const avatarClass = skinConfig.type;

  return (
    <div className="combat-hud">
      {uiMessage && (
        <div className={`combat-toast ${uiMessage.type}`}>
          {uiMessage.text}
        </div>
      )}

      {/* HUD de fin de combat */}
      {showCombatEnd && (
        <div className={`combat-end-overlay ${isWinner ? 'victory' : 'defeat'}`}>
          <div className="end-modal">
            <h1>{isWinner ? '🏆 VICTOIRE' : '💀 DÉFAITE'}</h1>
            <p>{isWinner ? 'Félicitations, vous avez terrassé votre adversaire !' : 'Dommage... Vous ferez mieux la prochaine fois !'}</p>
            <div className="end-modal-actions">
              <button className="exit-button" onClick={handleCombatExit}>
                Retour au Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP LEFT: PORTRAIT & STATS */}
      <div className="hud-character-block">
        <div className="hud-portrait-container">
          <div className="portrait-badge-wrapper">
            <div className={`portrait-circle ${isMyTurn ? 'is-my-turn' : 'not-my-turn'}`}>
               <div 
                className={`portrait-image avatar-${avatarClass}`}
                style={{ filter: `hue-rotate(${skinConfig.hue}deg) saturate(${skinConfig.saturation})` }}
               />
            </div>
            <div className="avatar-resources-group">
              <div className="res-item">
                <div className="res-circle pa">{currentPlayer.remainingPa}</div>
                <span className="res-label-mini">PA</span>
              </div>
              <div className="res-item">
                <div className="res-circle pm">{currentPlayer.remainingPm}</div>
                <span className="res-label-mini">PM</span>
              </div>
            </div>
          </div>
          
          <div className="stats-info">
            <span className="username">{user.username}</span>
            <div className="hp-bar-container">
              <div className="hp-bar-fill" style={{ width: `${Math.max(0, hpPercent)}%` }} />
            </div>
            
            <div className="hud-combined-stats">
              <span className="hp-text">{currentPlayer.currentVit} / {currentPlayer.stats.vit} PV</span>
            </div>
          </div>

          {(isMyTurn || isClosing) && (
            <button 
              className={`btn-end-turn-compact my-turn ${isClosing ? 'closing' : ''}`}
              onClick={handleEndTurn}
            >
              FIN DE TOUR
            </button>
          )}
        </div>

        <div className="actions-row">
            <button className="surrender-button" onClick={() => surrender()} title="Abandonner">
                QUITTER LE COMBAT
            </button>
            <button 
              className={`toggle-hp-button ${showEnemyHp ? 'active' : ''}`} 
              onClick={() => toggleShowEnemyHp()}
              title={showEnemyHp ? "Cacher les HP (afficher au survol)" : "Toujours afficher les HP"}
            >
              👁
            </button>
        </div>
      </div>

      {/* BOTTOM CENTER: SPELLS */}
      <div className="hud-bottom-anchor">
        <div className="spell-bar">
          {sortedSpells.map((spell) => {
            const onCooldown = (currentPlayer.spellCooldowns[spell.id] ?? 0) > 0;
            const notEnoughPa = currentPlayer.remainingPa < spell.paCost;
            const isActive = selectedSpellId === spell.id;
            const disabled = !isMyTurn || onCooldown || notEnoughPa;
            const family = SPELL_FAMILIES[spell.id] || 'warrior';
            const isHovered = hoveredSpellId === spell.id;

            return (
              <div 
                key={spell.id}
                className={`spell-card ${disabled ? 'disabled' : ''} ${isActive ? 'active' : ''} family-${family}`}
                onMouseEnter={() => setHoveredSpellId(spell.id)}
                onMouseLeave={() => setHoveredSpellId(null)}
                onClick={() => !disabled && setSelectedSpell(isActive ? null : spell.id)}
              >
                {isHovered && (
                  <div className="spell-hover-tag">
                    {spell.name}
                  </div>
                )}
                
                <div className="spell-pa-cost">{spell.paCost}</div>
                <img 
                  src={SPELL_ICONS[spell.id] || ''} 
                  className="spell-icon-img" 
                  alt={spell.name} 
                />
                {onCooldown && <div className="spell-cooldown-timer">{currentPlayer.spellCooldowns[spell.id]}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { useGameSession } from '../../pages/GameTunnel';
import { combatApi } from '../../api/combat.api';
import { CombatActionType, SpellFamily } from '@game/shared-types';
import { CombatResourceBar } from './CombatResourceBar';
import { EndTurnButton } from './EndTurnButton';
import { CombatPlayerPanel } from './CombatPlayerPanel';
import { getSkinById } from '../constants/skins';
import './CombatHUD.css';

const SPELL_FAMILY_ORDER: Record<SpellFamily, number> = {
  [SpellFamily.COMMON]: 1,
  [SpellFamily.WARRIOR]: 2,
  [SpellFamily.MAGE]: 3,
  [SpellFamily.NINJA]: 4,
};

function toFamilyClassName(family: SpellFamily | null | undefined) {
  return `family-${(family ?? SpellFamily.COMMON).toLowerCase()}`;
}

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
  const showMannequins = useCombatStore((s) => s.showMannequins);
  const toggleShowMannequins = useCombatStore((s) => s.toggleShowMannequins);
  const disconnect = useCombatStore((s) => s.disconnect);
  const uiMessage = useCombatStore((s) => s.uiMessage);
  const logs = useCombatStore((s) => s.logs);
  const setUiMessage = useCombatStore((s) => s.setUiMessage);
  const surrender = useCombatStore((s) => s.surrender);
  const [hoveredSpellId, setHoveredSpellId] = React.useState<string | null>(null);
  const [showLogs, setShowLogs] = React.useState(true);
  const [showTimeline, setShowTimeline] = React.useState(true);
  const user = useAuthStore((s) => s.player);
  const navigate = useNavigate();
  const { activeSession } = useGameSession();

  const currentPlayer = (combatState && user) ? combatState.players[user.id] : null;
  const enemyId = combatState && user ? Object.keys(combatState.players).find(id => id !== user.id) : null;
  const isMyTurn = (combatState && user) ? combatState.currentTurnPlayerId === user.id : false;

  React.useEffect(() => {
    if (!uiMessage) return;
    const timer = setTimeout(() => setUiMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [setUiMessage, uiMessage]);

  if (!combatState || !user || !currentPlayer) return null;

  const handleCombatExit = () => {
    disconnect();
    if (activeSession?.status === 'ACTIVE') {
      navigate('/farming', { replace: true });
    } else {
      navigate('/');
    }
  };

  const isWinner = winnerId === user.id;
  const showCombatEnd = !!winnerId;

  const sortedSpells = [...currentPlayer.spells].sort((a, b) => {
    const familyOrder = SPELL_FAMILY_ORDER[a.family] - SPELL_FAMILY_ORDER[b.family];
    if (familyOrder !== 0) return familyOrder;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });

  const canCastAnySpell = sortedSpells.some(s => 
    s.paCost <= currentPlayer.remainingPa && 
    (currentPlayer.spellCooldowns[s.id] || 0) === 0
  );
  const noActionsLeft = isMyTurn && !canCastAnySpell && (currentPlayer.remainingPm || 0) === 0;

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

  // Initiative order (highest INI first)
  // Note: Summons logic would go here if summonerId was available.
  const orderedFighters = Object.values(combatState.players)
    .slice()
    .sort((a, b) => (b.stats?.ini ?? 0) - (a.stats?.ini ?? 0));

  return (
    <div className="combat-hud">

      {uiMessage && (
        <div className={`combat-toast ${uiMessage.type}`}>
          {uiMessage.text}
        </div>
      )}

      {/* TOP LEFT: Turn Counter */}
      <div className="hud-turn-counter glass">
        <span className="turn-label">TOUR</span>
        <span className="turn-number">{combatState.turnNumber}</span>
      </div>

      {/* HUD de fin de combat */}
      {showCombatEnd && (
        <div className={`combat-end-overlay ${isWinner ? 'victory' : 'defeat'}`}>
          <div className="end-modal">
            <h1>{isWinner ? '🏆 VICTOIRE' : '💀 DÉFAITE'}</h1>
            <p>{isWinner ? 'Félicitations, vous avez terrassé votre adversaire !' : 'Dommage... Vous ferez mieux la prochaine fois !'}</p>
            <div className="end-modal-actions">
              <button className="exit-button" onClick={handleCombatExit}>
                {activeSession?.status === 'ACTIVE' ? 'Continuer' : 'Retour au Lobby'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT: Vertical Timeline (Dragon Quest Style) */}
      <div className={`hud-timeline-new ${!showTimeline ? 'collapsed' : ''}`}>
        {orderedFighters.map((f, i) => {
          const active = combatState.currentTurnPlayerId === f.playerId;
          const self = f.playerId === user.id;
          const skin = getSkinById(f.skin || 'soldier-classic');
          const hpPercent = Math.max(0, Math.min(100, (f.currentVit / (f.stats?.vit || 100)) * 100));
          const paPercent = Math.max(0, Math.min(100, (f.remainingPa / (f.stats?.pa || 6)) * 100));

          return (
            <div
              key={f.playerId}
              className={`timeline-card ${active ? 'active' : ''} ${self ? 'self' : 'foe'}`}
            >
              <div className="card-character-box">
                <div
                  className={`card-avatar avatar-${skin.type}`}
                  style={{ filter: `hue-rotate(${skin.hue}deg) saturate(${skin.saturation})` }}
                />
              </div>
              <div className="card-stats">
                <div className="card-username">{f.username}</div>
                <div className="card-bars">
                  <div className="card-bar-wrapper hp">
                    <div className="card-bar-fill" style={{ width: `${hpPercent}%` }} />
                    <span className="card-bar-text">{f.currentVit}</span>
                  </div>
                </div>
              </div>
              {active && <div className="card-active-indicator" />}
            </div>
          );
        })}
        {/* Bottom Toggle Button */}
        <div className="timeline-footer">
          <button 
            className="timeline-toggle-btn glass-interactive"
            onClick={() => setShowTimeline(!showTimeline)}
            title={showTimeline ? "Réduire la timeline" : "Agrandir la timeline"}
          >
            {showTimeline ? '«' : '»'}
          </button>
        </div>
      </div>

      {/* BOTTOM PLAYER PANELS */}
      <CombatPlayerPanel playerId={user.id} side="left" />
      {enemyId && <CombatPlayerPanel playerId={enemyId} side="right" position="top" />}

      {/* BOTTOM CENTER: SPELLS */}
      <div className="hud-bottom-anchor">
          <div className="spell-bar-new glass-panel">
            <div className="spell-bar-left-col">
              <div className="spell-slots-grid">
                {Array.from({ length: 6 }).map((_, i) => {
                  const spell = sortedSpells[i];
                  if (!spell) {
                    return <div key={`empty-${i}`} className="spell-slot empty" />;
                  }

                  const cooldown = currentPlayer.spellCooldowns[spell.id] || 0;
                  const isAffordable = spell.paCost <= currentPlayer.remainingPa;
                  const isDisabled = !isMyTurn || cooldown > 0 || !isAffordable;
                  const isActive = selectedSpellId === spell.id;

                  return (
                    <div
                      key={spell.id}
                      className={`spell-slot glass-interactive ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}
                      onClick={() => !isDisabled && setSelectedSpell(spell.id)}
                    >
                      <div className="spell-icon-box">
                        <img src={spell.iconPath ?? '/assets/pack/spells/epee.png'} alt={spell.name} className="spell-img" />
                      </div>

                      <div className="spell-pa-diamond">
                        <span>{spell.paCost}</span>
                      </div>

                      {cooldown > 0 && (
                        <div className="cooldown-overlay">
                          <span>{cooldown}</span>
                        </div>
                      )}

                      <div className="spell-tooltip glass">
                        <strong>{spell.name}</strong>
                        <p>{spell.description || 'Pas de description.'}</p>
                        <div className="spell-stats">
                          <span>Range: {spell.minRange}-{spell.maxRange}</span>
                          <span>Dmg: {spell.damage.min}-{spell.damage.max}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <CombatResourceBar 
                remainingPa={currentPlayer.remainingPa}
                maxPa={currentPlayer.stats.pa || 12}
              />
            </div>



            <EndTurnButton 
              isMyTurn={isMyTurn}
              noActionsLeft={noActionsLeft}
              canCastAnySpell={canCastAnySpell}
              remainingPa={currentPlayer.remainingPa}
              remainingPm={currentPlayer.remainingPm || 0}
              onEndTurn={handleEndTurn}
            />
            
            {!winnerId && (
              <div className="surrender-wrapper">
                <button 
                  className="action-btn surrender-btn"
                  onClick={surrender}
                  title="Abandonner le combat"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="surrender-flag-icon"
                  >
                    <rect x="4" y="4" width="16" height="11" />
                    <rect x="4" y="4" width="2" height="18" />
                  </svg>
                </button>
                <div className="mini-resource-indicators">
                  <div 
                    className={`mini-diamond pa ${canCastAnySpell ? 'active' : ''}`} 
                    title={`PA restants: ${currentPlayer.remainingPa} ${!canCastAnySpell ? '(insuffisants)' : ''}`}
                  />
                  <div 
                    className={`mini-diamond pm ${(currentPlayer.remainingPm || 0) > 0 ? 'active' : ''}`} 
                    title={`PM restants: ${currentPlayer.remainingPm}`}
                  />
                </div>
              </div>
            )}
          </div>

        {/* Logs de combat (Extreme Bas Droite) */}
        <div className={`combat-logs-wrapper-fixed ${showLogs ? 'expanded' : 'collapsed'}`}>
          <div className="logs-content glass">
            {logs.length === 0 ? (
              <div className="no-logs">Aucun événement...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`log-entry log-${log.type}`}>
                  <span className="log-msg">{log.message}</span>
                </div>
              ))
            )}
          </div>

          <button 
            className="logs-toggle-icon-btn"
            onClick={() => setShowLogs(!showLogs)}
            title={showLogs ? "Cacher les logs" : "Afficher les logs"}
          >
            <span className="toggle-icon-svg">
              {showLogs ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              )}
            </span>
          </button>
        </div>

        {/* Targeting prompt when a spell is selected */}

      </div>
    </div>
  );
}

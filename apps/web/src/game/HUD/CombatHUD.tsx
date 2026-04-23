import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { useGameSession } from '../../pages/GameTunnel';
import { combatApi } from '../../api/combat.api';
import { CombatActionType, SpellFamily } from '@game/shared-types';
import { getSkinById } from '../../game/constants/skins';
import { CombatPlayerPanel } from './CombatPlayerPanel';
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
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
      'string'
  ) {
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
    );
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
  const showMannequins = useCombatStore((s) => s.showMannequins);
  const toggleShowMannequins = useCombatStore((s) => s.toggleShowMannequins);
  const surrender = useCombatStore((s) => s.surrender);
  const disconnect = useCombatStore((s) => s.disconnect);
  const uiMessage = useCombatStore((s) => s.uiMessage);
  const setUiMessage = useCombatStore((s) => s.setUiMessage);
  const [hoveredSpellId, setHoveredSpellId] = React.useState<string | null>(null);
  const user = useAuthStore((s) => s.player);
  const navigate = useNavigate();
  const { activeSession } = useGameSession();

  const currentPlayer = combatState && user ? combatState.players[user.id] : null;
  const enemyId =
    combatState && user ? Object.keys(combatState.players).find((id) => id !== user.id) : null;
  const isMyTurn = combatState && user ? combatState.currentTurnPlayerId === user.id : false;

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
    if (familyOrder !== 0) {
      return familyOrder;
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    return a.name.localeCompare(b.name);
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
      {uiMessage && <div className={`combat-toast ${uiMessage.type}`}>{uiMessage.text}</div>}

      {/* HUD de fin de combat */}
      {showCombatEnd && (
        <div className={`combat-end-overlay ${isWinner ? 'victory' : 'defeat'}`}>
          <div className="end-modal">
            <h1>{isWinner ? '🏆 VICTOIRE' : '💀 DÉFAITE'}</h1>
            <p>
              {isWinner
                ? 'Félicitations, vous avez terrassé votre adversaire !'
                : 'Dommage... Vous ferez mieux la prochaine fois !'}
            </p>
            <div className="end-modal-actions">
              <button className="exit-button" onClick={handleCombatExit}>
                {activeSession?.status === 'ACTIVE' ? 'Continuer' : 'Retour au Lobby'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CombatPlayerPanel playerId={user.id} side="left" />
      {enemyId && <CombatPlayerPanel playerId={enemyId} side="right" />}

      {/* BOTTOM CENTER: SPELLS */}
      <div className="hud-bottom-anchor">
        <div className="spell-bar">
          {sortedSpells.map((spell) => {
            const onCooldown = (currentPlayer.spellCooldowns[spell.id] ?? 0) > 0;
            const notEnoughPa = currentPlayer.remainingPa < spell.paCost;
            const isActive = selectedSpellId === spell.id;
            const disabled = !isMyTurn || onCooldown || notEnoughPa;
            const familyClassName = toFamilyClassName(spell.family);
            const isHovered = hoveredSpellId === spell.id;

            return (
              <div
                key={spell.id}
                className={`spell-card ${disabled ? 'disabled' : ''} ${isActive ? 'active' : ''} ${familyClassName}`}
                onMouseEnter={() => setHoveredSpellId(spell.id)}
                onMouseLeave={() => setHoveredSpellId(null)}
                onClick={() => !disabled && setSelectedSpell(isActive ? null : spell.id)}
              >
                {isHovered && <div className="spell-hover-tag">{spell.name}</div>}

                <div className="spell-pa-cost">{spell.paCost}</div>
                <img
                  src={spell.iconPath ?? '/assets/pack/spells/epee.png'}
                  className="spell-icon-img"
                  alt={spell.name}
                />
                {onCooldown && (
                  <div className="spell-cooldown-timer">
                    {currentPlayer.spellCooldowns[spell.id]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { getSkinById } from '../../game/constants/skins';
import { combatApi } from '../../api/combat.api';
import { CombatActionType, SpellFamily } from '@game/shared-types';
import './CombatPlayerPanel.css';

interface CombatPlayerPanelProps {
  playerId: string;
  side: 'left' | 'right';
}

export function CombatPlayerPanel({ playerId, side }: CombatPlayerPanelProps) {
  const combatState = useCombatStore((s) => s.combatState);
  const sessionId = useCombatStore((s) => s.sessionId);
  const setCombatState = useCombatStore((s) => s.setCombatState);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  const setUiMessage = useCombatStore((s) => s.setUiMessage);
  const showEnemyHp = useCombatStore((s) => s.showEnemyHp);
  const toggleShowEnemyHp = useCombatStore((s) => s.toggleShowEnemyHp);
  const showMannequins = useCombatStore((s) => s.showMannequins);
  const toggleShowMannequins = useCombatStore((s) => s.toggleShowMannequins);
  const surrender = useCombatStore((s) => s.surrender);

  const user = useAuthStore((s) => s.player);
  const isMe = user?.id === playerId;

  const player = combatState?.players[playerId];
  if (!player) return null;

  const isMyTurn = combatState?.currentTurnPlayerId === playerId;
  const hpPercent = (player.currentVit / (player.stats?.vit || 1)) * 100;
  const skinConfig = getSkinById(player.skin || 'soldier-classic');
  const avatarClass = skinConfig.type;

  const handleEndTurn = async () => {
    if (!sessionId || !isMe || !isMyTurn) return;
    try {
      const res = await combatApi.playAction(sessionId, { type: CombatActionType.END_TURN });
      if (res?.data) setCombatState(res.data);
      setSelectedSpell(null);
    } catch (err) {
      console.error('CombatPlayerPanel: End turn failed', err);
      setUiMessage('Impossible de terminer le tour.', 'error');
    }
  };

  return (
    <div className={`combat-player-panel side-${side} ${isMyTurn ? 'is-turn' : ''}`}>
      <div className="panel-main-row">
        {/* AVATAR & RESOURCES */}
        <div className="portrait-wrapper">
          <div className={`portrait-circle ${isMyTurn ? 'pulse' : ''}`}>
            <div
              className={`portrait-image avatar-${avatarClass}`}
              style={{
                filter: `hue-rotate(${skinConfig.hue}deg) saturate(${skinConfig.saturation})`,
              }}
            />
          </div>
        </div>

        {/* INFO & HP */}
        <div className="info-column">
          <div className="name-row">
            <span className="player-name">{player.username}</span>
            {isMe && <span className="me-badge">VOUS</span>}
          </div>

          <div className="hp-container">
            <div className="hp-bar">
              <div className="hp-fill" style={{ width: `${Math.max(0, hpPercent)}%` }} />
            </div>

            <div className="hp-values-row">
              <div className="resources-row">
                <div className="res-minimal pa">{player.remainingPa}</div>
                <div className="res-minimal pm">{player.remainingPm}</div>
              </div>
              <span className="hp-text">
                {player.currentVit} / {player.stats.vit} PV
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* UTILITY BUTTONS (Only on local player panel) */}
      {isMe && (
        <div className="panel-utility-row">
          <button className="util-btn surrender" onClick={() => surrender()} title="Surrender">
            🏳️ Quitter
          </button>
          <button
            className={`util-btn ${showEnemyHp ? 'active' : ''}`}
            onClick={() => toggleShowEnemyHp()}
            title="Toggle HP"
          >
            👁 HP
          </button>
          <button
            className={`util-btn ${showMannequins ? 'active' : ''}`}
            onClick={() => toggleShowMannequins()}
            title="Toggle Mannequins"
          >
            👤 Équip.
          </button>
        </div>
      )}

      {/* EQUIPMENT (MANNEQUINS) */}
      <div className={`equipment-expansion ${showMannequins ? 'is-visible' : ''}`}>
        <div className="equipment-grid">
          {player.items && player.items.length > 0 ? (
            player.items.map((it: any) => (
              <div
                key={it.id}
                className={`eq-item rank-${it.rank || 1}`}
                title={it.description || ''}
              >
                <span className="eq-name">{it.name}</span>
              </div>
            ))
          ) : (
            <div className="eq-empty">Aucun équipement</div>
          )}
        </div>

        <div className="stats-grid">
          <div className="stat-box">
            <span>ATK</span>
            <strong>{player.stats.atk}</strong>
          </div>
          <div className="stat-box">
            <span>DEF</span>
            <strong>{player.stats.def}</strong>
          </div>
          <div className="stat-box">
            <span>MAG</span>
            <strong>{player.stats.mag}</strong>
          </div>
          <div className="stat-box">
            <span>RES</span>
            <strong>{player.stats.res}</strong>
          </div>
        </div>
      </div>

      {/* END TURN BUTTON (Bottom) */}
      {isMe && isMyTurn && (
        <button className="panel-end-turn-bottom" onClick={handleEndTurn}>
          TERMINER LE TOUR
        </button>
      )}
    </div>
  );
}

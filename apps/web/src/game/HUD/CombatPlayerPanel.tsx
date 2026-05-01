import React from 'react';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { getSkinById } from '../../game/constants/skins';
import { SpellDefinition, SpellFamily } from '@game/shared-types';
import './CombatPlayerPanel.css';

interface CombatPlayerPanelProps {
  playerId: string;
  side: 'left' | 'right';
  position?: 'top' | 'bottom';
}

export function CombatPlayerPanel({ playerId, side, position = 'bottom' }: CombatPlayerPanelProps) {
  const combatState = useCombatStore((s) => s.combatState);
  const user = useAuthStore((s) => s.player);
  const isMe = user?.id === playerId;

  const player = combatState?.players[playerId];
  if (!player) return null;

  const isMyTurn = combatState?.currentTurnPlayerId === playerId;
  const maxHp = player.stats?.vit || 1;
  const hpPercent = Math.max(0, Math.min(100, (player.currentVit / maxHp) * 100));
  const skin = getSkinById(player.skin || 'soldier-classic');

  return (
    <div className={`cpp-root side-${side} position-${position} ${isMyTurn ? 'is-turn' : ''}`}>
      <div className="cpp-main-frame">
        {/* Avatar Section */}
        <div className="cpp-avatar-section">
          <img src="/goblin_avatar.png" alt="Avatar" className="cpp-avatar-img" />
        </div>

        {/* Name Section */}
        <div className="cpp-name-section">
          {player.username}
        </div>

        {/* HP Section */}
        <div className="cpp-hp-section">
          <div className="cpp-hp-fill" style={{ width: `${hpPercent}%` }} />
          <div className="cpp-hp-text">{player.currentVit} / {maxHp}</div>
        </div>
      </div>

      {/* Side Resources (Old Design) */}
      <div className="cpp-side-resources">
        <div className="res-badge mini pa">
          {player.remainingPa}
        </div>
        <div className="res-badge mini pm">
          {player.remainingPm}
        </div>
      </div>
    </div>
  );
}

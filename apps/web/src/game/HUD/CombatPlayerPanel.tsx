import React from 'react';

import type { SpellDefinition} from '@game/shared-types';
import { SpellFamily } from '@game/shared-types';

import { getSkinById } from '../../game/constants/skins';
import { useAuthStore } from '../../store/auth.store';
import { useCombatStore } from '../../store/combat.store';

import './CombatPlayerPanel.css';

interface CombatPlayerPanelProps {
  playerId: string;
  side: 'left' | 'right';
}

const FAMILY_LABEL: Record<SpellFamily, string> = {
  [SpellFamily.COMMON]: 'INITIÉ',
  [SpellFamily.WARRIOR]: 'GUERRIER',
  [SpellFamily.MAGE]: 'ARCANE',
  [SpellFamily.NINJA]: 'OMBRE',
};

function getDominantFamily(spells: SpellDefinition[]): SpellFamily {
  const counts: Partial<Record<SpellFamily, number>> = {};
  for (const s of spells) {
    if (s.family === SpellFamily.COMMON) continue;
    counts[s.family] = (counts[s.family] || 0) + 1;
  }
  let best: SpellFamily = SpellFamily.COMMON;
  let max = 0;
  for (const [family, count] of Object.entries(counts)) {
    if ((count as number) > max) { max = count as number; best = family as SpellFamily; }
  }
  return best;
}

export function CombatPlayerPanel({ playerId, side }: CombatPlayerPanelProps) {
  const combatState = useCombatStore((s) => s.combatState);
  const user = useAuthStore((s) => s.player);
  const isMe = user?.id === playerId;

  const player = combatState?.players[playerId];
  if (!player) return null;

  const isMyTurn = combatState?.currentTurnPlayerId === playerId;
  const maxHp = player.stats?.vit || 1;
  const hpPercent = Math.max(0, Math.min(100, (player.currentVit / maxHp) * 100));
  const skinConfig = getSkinById(player.skin || 'soldier-classic');
  const avatarClass = skinConfig.type;

  const family = getDominantFamily(player.spells || []);
  const familyLabel = FAMILY_LABEL[family];

  return (
    <div className={`combat-player-panel glass side-${side} ${isMyTurn ? 'is-turn' : ''} ${isMe ? 'is-me' : 'is-enemy'}`}>
      {/* Name header */}
      <div className="cpp-header">
        <div className="cpp-name">{player.username}</div>
        <span className={`cpp-archetype family-${family.toLowerCase()}`}>{familyLabel}</span>
      </div>

      {/* Portrait */}
      <div className="cpp-portrait-wrap">
        <div className={`cpp-portrait ${isMyTurn ? 'pulse' : ''}`}>
          <div
            className={`portrait-image avatar-${avatarClass}`}
            style={{ filter: `hue-rotate(${skinConfig.hue}deg) saturate(${skinConfig.saturation})` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="cpp-stats">
        <div className="cpp-stat stat-atk"><span className="cpp-stat-label">ATK</span><strong>{player.stats.atk}</strong></div>
        <div className="cpp-stat stat-def"><span className="cpp-stat-label">DEF</span><strong>{player.stats.def}</strong></div>
        <div className="cpp-stat stat-mag"><span className="cpp-stat-label">MAG</span><strong>{player.stats.mag}</strong></div>
        <div className="cpp-stat stat-res"><span className="cpp-stat-label">RES</span><strong>{player.stats.res}</strong></div>
      </div>

      {/* HP bar */}
      <div className="cpp-hp-row">
        <div className="cpp-hp-bar">
          <div className="cpp-hp-fill" style={{ width: `${hpPercent}%` }} />
        </div>
      </div>

      {/* PA / PM / HP footer */}
      <div className="cpp-footer">
        <span className="cpp-res res-pa">◆PA {player.remainingPa}/{player.stats.pa}</span>
        <span className="cpp-res res-pm">◆PM {player.remainingPm}/{player.stats.pm}</span>
        <span className="cpp-res res-hp">HP {player.currentVit}/{maxHp}</span>
      </div>
    </div>
  );
}

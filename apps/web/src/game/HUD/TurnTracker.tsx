import React from 'react';

import type { CombatPlayer } from '@game/shared-types';

import { getSkinById } from '../../game/constants/skins';

import './TurnTracker.css';

interface TurnTrackerProps {
  fighters: CombatPlayer[];
  currentTurnPlayerId: string;
  turnNumber: number;
  selfId: string;
}

const SLOT_COUNT = 5;

interface SlotInfo {
  fighter: CombatPlayer;
  index: number;
  isActive: boolean;
}

function buildSlots(fighters: CombatPlayer[], currentTurnPlayerId: string): SlotInfo[] {
  if (fighters.length === 0) return [];
  return fighters.map((fighter, i) => {
    return { fighter, index: i, isActive: fighter.playerId === currentTurnPlayerId };
  });
}

interface AvatarCircleProps {
  fighter: CombatPlayer;
  isActive: boolean;
  isSelf: boolean;
  index: number;
}

function AvatarCircle({ fighter, isActive, isSelf, index }: AvatarCircleProps) {
  const skinConfig = getSkinById(fighter.skin ?? 'soldier-classic');
  const classes = [
    'tt-avatar',
    isActive ? 'tt-avatar--active' : '',
    isSelf ? 'tt-avatar--self' : 'tt-avatar--foe',
  ].filter(Boolean).join(' ');

  return (
    <div className="tt-slot-wrapper">
      <div className={classes} title={fighter.username}>
        {fighter.type === 'SUMMON' ? (
          <>
            <span className="tt-avatar-emoji">🗿</span>
            <span className="tt-passive-badge" title="Ne joue pas de tour">♾️</span>
          </>
        ) : (
          <div
            className={`tt-avatar-sprite avatar-${skinConfig.type}`}
            style={{ filter: `hue-rotate(${skinConfig.hue}deg) saturate(${skinConfig.saturation})` }}
          />
        )}
      </div>
      {fighter.type !== 'SUMMON' && <div className="tt-slot-number">{index + 1}</div>}
    </div>
  );
}

export function TurnTracker({ fighters, currentTurnPlayerId, turnNumber, selfId }: TurnTrackerProps) {
  const ordered = React.useMemo(
    () => [...fighters].sort((a, b) => (b.stats?.ini ?? 0) - (a.stats?.ini ?? 0)),
    [fighters],
  );

  const slots = buildSlots(ordered, currentTurnPlayerId);

  return (
    <div className="turn-tracker">
      <div className="tt-turn-label">TOUR {turnNumber}</div>
      <div className="tt-slots">
        {slots.map((slot, i) => (
          <AvatarCircle
            key={`${slot.fighter.playerId}-${slot.index}`}
            fighter={slot.fighter}
            isActive={slot.isActive}
            isSelf={slot.fighter.playerId === selfId || slot.fighter.casterId === selfId}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

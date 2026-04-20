import React from 'react';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { getSkinById } from '../../game/constants/skins';
import './CombatMannequins.css';

export function CombatMannequins() {
  const combatState = useCombatStore((s) => s.combatState);
  const user = useAuthStore((s) => s.player);
  const showMannequins = useCombatStore((s) => s.showMannequins);

  if (!combatState || !user) return null;
  if (!showMannequins) return null;

  const playerIds = Object.keys(combatState.players);
  if (playerIds.length < 2) return null;

  const p1 = combatState.players[user.id];
  const p2 = Object.values(combatState.players).find(p => p.playerId !== user.id);
  
  if (!p1 || !p2) return null;

  const renderPlayerPanel = (player: typeof p1, side: 'left' | 'right') => {
    const skinConfig = getSkinById(player.skin || 'soldier-classic');
    
    return (
      <div className={`combat-mannequin-panel ${side}`}>
        <div className="mannequin-header">
           <div className={`portrait-mini avatar-${skinConfig.type}`} style={{ filter: `hue-rotate(${skinConfig.hue}deg) saturate(${skinConfig.saturation})` }} />
           <span>{player.username}</span>
        </div>
        <div className="mannequin-items">
           {player.items && player.items.length > 0 ? (
               player.items.map((it) => (
                   <div key={it.id} className={`mannequin-item rank-${it.rank || 1}`} title={it.description || ''}>
                       {it.name}
                   </div>
               ))
           ) : (
               <div className="mannequin-item empty">Aucun équipement</div>
           )}
        </div>
        <div className="mannequin-stats">
           <span>ATK: {player.stats.atk}</span>
           <span>DEF: {player.stats.def}</span>
           <span>MAG: {player.stats.mag}</span>
           <span>RES: {player.stats.res}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="combat-mannequins-wrapper">
       {renderPlayerPanel(p1, 'left')}
       {renderPlayerPanel(p2, 'right')}
    </div>
  );
}

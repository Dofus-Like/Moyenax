import React, { useMemo } from 'react';
import { getSkinById } from '../../game/constants/skins';
import './PlayerAvatar.css';

interface PlayerAvatarProps {
  skin: string;
  size?: number | string;
  animation?: 'idle' | 'walk' | 'attack';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Composant réutilisable pour afficher l'avatar d'un joueur.
 * Supporte le changement de skin (hue, saturation) et les animations CSS.
 */
export function PlayerAvatar({ 
  skin, 
  size = 80, 
  animation = 'idle',
  className = '',
  style 
}: PlayerAvatarProps) {
  const skinConfig = useMemo(() => getSkinById(skin || 'soldier-classic'), [skin]);
  
  const widthStr = typeof size === 'number' ? `${size}px` : size;
  const heightStr = typeof size === 'number' ? `${size}px` : size;

  return (
    <div 
      className={`player-avatar-root ${className}`}
      style={{ 
        width: widthStr, 
        height: heightStr,
        ...style 
      }}
    >
      <div 
        className={`avatar-sprite-img type-${skinConfig.type} anim-${animation}`}
        style={{ 
          filter: `hue-rotate(${skinConfig.hue}deg) saturate(${skinConfig.saturation})` 
        }}
      />
    </div>
  );
}

import React from 'react';
import './CombatResourceBar.css';

interface CombatResourceBarProps {
  type: 'pa' | 'pm';
  remaining: number;
  max: number;
  showTrack?: boolean;
}

export const CombatResourceBar: React.FC<CombatResourceBarProps> = ({
  type,
  remaining,
  max,
  showTrack = false,
}) => {
  return (
    <div className={`resource-diamonds-bar ${type}`}>
      <div className={`resource-tag-wrapper ${type}`}>
        <div className="resource-diamond-tag">
          <span>{remaining}</span>
        </div>
        <div className="resource-icon-wrapper">
          {type === 'pa' ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="resource-icon pa">
              <path d="M13 10V3L4 14H11V21L20 10H13Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="resource-icon pm">
              <circle cx="12" cy="12" r="8" />
            </svg>
          )}
        </div>
      </div>
      
      {showTrack && (
        <div className={`gauge-row ${type}`}>
          {Array.from({ length: 12 }).map((_, i) => {
            const isFilled = i < remaining;
            const isAvailable = i < max;
            return (
              <div 
                key={i} 
                className={`gauge-diamond ${isFilled ? 'filled' : ''} ${!isAvailable ? 'unavailable' : ''}`}
              >
                <div className="diamond-inner" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

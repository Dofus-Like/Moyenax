import React from 'react';
import './CombatResourceBar.css';

interface CombatResourceBarProps {
  remainingPa: number;
  maxPa: number;
}

export const CombatResourceBar: React.FC<CombatResourceBarProps> = ({
  remainingPa,
  maxPa,
}) => {
  return (
    <div className="resource-diamonds-bar">
      <span className="resource-counter">{remainingPa}/{maxPa}</span>
      <div className="gauge-row pa">
        {Array.from({ length: 12 }).map((_, i) => {
          const isFilled = i < remainingPa;
          const isAvailable = i < maxPa;
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
    </div>
  );
};

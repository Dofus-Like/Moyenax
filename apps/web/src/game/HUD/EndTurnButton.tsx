import React from 'react';

interface EndTurnButtonProps {
  isMyTurn: boolean;
  noActionsLeft: boolean;
  canCastAnySpell: boolean;
  remainingPa: number;
  remainingPm: number;
  onEndTurn: () => void;
}

export const EndTurnButton: React.FC<EndTurnButtonProps> = ({
  isMyTurn,
  noActionsLeft,
  onEndTurn
}) => {
  return (
    <div className="end-turn-wrapper">
      <div className="hex-btn-wrapper">
        <div className="hex-outer">
          <div className={`hex-timer-block ${isMyTurn ? 'active' : ''} ${noActionsLeft ? 'suggested' : ''}`} />
          <button
            className={`hex-inner ${isMyTurn ? 'my-turn' : ''} ${noActionsLeft ? 'suggested' : ''}`}
            disabled={!isMyTurn}
            onClick={onEndTurn}
            title={noActionsLeft ? "Plus d'actions possibles - Finir le tour" : "Finir le tour"}
          >
            {isMyTurn ? (
              <>
                <span>{noActionsLeft ? "END" : "PASS"}</span>
                <span>TURN</span>
              </>
            ) : (
              <>
                <span>ENEMY'S</span>
                <span>TURN</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

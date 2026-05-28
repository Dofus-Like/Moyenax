import React from "react";

import "./EndTurnButton.css";

interface EndTurnButtonProps {
  isMyTurn: boolean;
  onEndTurn: () => void;
  turnDurationSec?: number;
  canCastSpell?: boolean;
  hasPm?: boolean;
}

// Losange : polygone 72×72, pointes aux 4 côtés — périmètre = 4 × côté
// Côté = sqrt(36²+36²) ≈ 50.91 → périmètre ≈ 203.6
const DIAMOND_POINTS = "36,2 70,36 36,70 2,36";
const SIDE = Math.sqrt(36 * 36 + 36 * 36);
const PERIMETER = 4 * SIDE;
const TICK_MS = 100;

function getStrokeColor(progress: number, durationSec: number): string {
  const remainingSec = progress * durationSec;
  if (remainingSec <= 5) return "#ef4444";
  return "#fca800";
}

function useCountdown(isActive: boolean, durationSec: number) {
  const [progress, setProgress] = React.useState(1);
  const elapsedRef = React.useRef(0);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    elapsedRef.current = 0;
    setProgress(1);
    if (!isActive) return;

    intervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS;
      const next = Math.max(0, 1 - elapsedRef.current / (durationSec * 1000));
      setProgress(next);
    }, TICK_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, durationSec]);

  return progress;
}

export function EndTurnButton({
  isMyTurn,
  onEndTurn,
  turnDurationSec = 30,
  canCastSpell = false,
  hasPm = false,
}: EndTurnButtonProps) {
  const progress = useCountdown(isMyTurn, turnDurationSec);
  const dashOffset = PERIMETER * (1 - progress);
  const strokeColor = isMyTurn
    ? getStrokeColor(progress, turnDurationSec)
    : "rgba(255,255,255,0.18)";
  const isLow = isMyTurn && (progress * turnDurationSec) <= 5;
  const isNoActionsLeft = isMyTurn && !canCastSpell && !hasPm;

  return (
    <div className="end-turn-wrapper">
      <button
        type="button"
        className={`end-turn-btn ${isMyTurn ? "is-my-turn" : ""} ${isLow ? "is-low" : ""} ${isNoActionsLeft ? "no-actions-left" : ""}`}
        disabled={!isMyTurn}
        onClick={() => {
          if (isMyTurn) onEndTurn();
        }}
        aria-label={isMyTurn ? "Terminer le tour" : "En attente"}
      >
        <svg className="end-turn-ring" viewBox="0 0 72 72" width="72" height="72">
          {/* Contour noir extérieur */}
          <polygon className="etb-border-outer" points="36,0 72,36 36,72 0,36" />
          {/* Fond + contour blanc */}
          <polygon className="end-turn-ring-bg" points={DIAMOND_POINTS} />
          {/* Contour noir intérieur */}
          <polygon className="etb-border-inner" points="36,5 67,36 36,67 5,36" />
          {/* Timer progressif */}
          <polygon
            className="end-turn-ring-fill"
            points={DIAMOND_POINTS}
            style={{
              strokeDasharray: PERIMETER,
              strokeDashoffset: dashOffset,
              stroke: strokeColor,
            }}
          />
        </svg>
        <span className="end-turn-label">
          {isMyTurn ? (
            isNoActionsLeft ? (
              <>END<br />TURN</>
            ) : (
              <>PASS<br />TURN</>
            )
          ) : (
            "…"
          )}
        </span>
      </button>
    </div>
  );
}

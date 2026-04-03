import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarmingStore } from '../../store/farming.store';
import './FarmingHUD.css';
import './FarmingHUD.retro.css';

export function FarmingHUD() {
  const { pips, round, endPhase } = useFarmingStore();
  const navigate = useNavigate();

  const handleEndPhase = async () => {
    await endPhase();
    // Redirect to the shop as placeholder for transition
    navigate('/shop');
  };

  return (
    <div className="farming-hud">
      <div className="hud-top">
        <span className="round-badge">Manche {round} / 5</span>
      </div>
      <div className="hud-center">
        <div className="pips-container">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`pip ${i < pips ? 'filled' : 'empty'}`} />
          ))}
        </div>
        <div className="pips-label">{pips} / 4 récoltes restantes</div>
      </div>
      <div className="hud-bottom">
        <button className="end-phase-btn" onClick={handleEndPhase}>
          Aller au Shop / Crafting
        </button>
      </div>
    </div>
  );
}

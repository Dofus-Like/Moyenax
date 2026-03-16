import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { CombatMapScene } from '../game/CombatMap/CombatMapScene';
import { CombatHUD } from '../game/HUD/CombatHUD';
import { useCombatStore } from '../store/combat.store';
import './CombatPage.css';

export function CombatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { connectToSession, disconnect, combatState } = useCombatStore();

  useEffect(() => {
    if (sessionId) {
      connectToSession(sessionId);
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connectToSession, disconnect]);

  return (
    <div className="combat-container">
      <header className="combat-header">
        <button className="back-button" onClick={() => { disconnect(); navigate('/'); }}>
          ← Quitter
        </button>
        <h2>⚔️ Combat</h2>
        {combatState && (
          <span className="combat-turn">Tour {combatState.turnNumber}</span>
        )}
      </header>

      <div className="combat-arena">
        <Canvas>
          <OrthographicCamera makeDefault position={[5, 5, 5]} zoom={40} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <CombatMapScene />
        </Canvas>

        <CombatHUD />
      </div>
    </div>
  );
}

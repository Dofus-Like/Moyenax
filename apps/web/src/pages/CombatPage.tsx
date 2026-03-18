import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, MapControls } from '@react-three/drei';
import { CombatMapScene } from '../game/CombatMap/CombatMapScene';
import { CombatHUD } from '../game/HUD/CombatHUD';
import { useCombatStore } from '../store/combat.store';
import { useAuthStore } from '../store/auth.store';
import './CombatPage.css';

export function CombatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { combatState } = useCombatStore();
  const authInitialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    authInitialize();
  }, [authInitialize]);

  if (!sessionId) return null;

  return (
    <div className="combat-container">
      <header className="combat-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Quitter
        </button>
        <h2>⚔️ Combat</h2>
        {combatState && (
          <span className="combat-turn">Tour {combatState.turnNumber}</span>
        )}
      </header>

      {!combatState && (
          <div className="combat-overlay">
              <div className="loading-spinner"></div>
              <p>Chargement du combat...</p>
          </div>
      )}

      <div className="combat-arena">
        <Canvas shadows>
          <OrthographicCamera 
            makeDefault 
            position={[40, 40, 40]} 
            zoom={30} 
            near={0.1} 
            far={1000} 
          />
          <MapControls 
            enableRotate={false} 
            target={[5, 0, 5]} 
            minZoom={20} 
            maxZoom={100} 
          />
          <ambientLight intensity={0.5} />
          <hemisphereLight args={['#87CEEB', '#654321', 0.6]} />
          <directionalLight
            position={[10, 15, 10]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          <CombatMapScene sessionId={sessionId} />
        </Canvas>

        <CombatHUD />
      </div>
    </div>
  );
}

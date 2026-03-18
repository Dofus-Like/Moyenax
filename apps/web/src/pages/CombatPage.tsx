import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { UnifiedMapScene } from '../game/UnifiedMap/UnifiedMapScene';
import { CombatHUD } from '../game/HUD/CombatHUD';
import { useCombatStore } from '../store/combat.store';
import { useAuthStore } from '../store/auth.store';
import { TerrainType } from '@game/shared-types';
import './CombatPage.css';

export function CombatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { combatState, connectToSession, disconnect } = useCombatStore();
  const authInitialize = useAuthStore((s) => s.initialize);
  const [isCameraMoving, setIsCameraMoving] = React.useState(false);
  const controlsRef = React.useRef<CameraControlsImpl>(null);

  const onRest = React.useCallback(() => setIsCameraMoving(false), []);
  const onStart = React.useCallback(() => setIsCameraMoving(true), []);

  useEffect(() => {
    authInitialize();
  }, [authInitialize]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK;
      controlsRef.current.mouseButtons.right = CameraControlsImpl.ACTION.ROTATE;
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      connectToSession(sessionId);
    }
    return () => {
      disconnect();
    };
  }, [sessionId, connectToSession, disconnect]);

  // Construire une GameMap fictive à partir de combatState pour UnifiedMapScene
  const gameMap = useMemo(() => {
    if (!combatState?.map?.tiles) return null;
    
    const grid = Array(combatState.map.height)
      .fill(0)
      .map(() => Array(combatState.map.width).fill(TerrainType.GROUND));
    
    combatState.map.tiles.forEach((t) => {
      if (grid[t.y] && grid[t.y][t.x] !== undefined) {
        grid[t.y][t.x] = t.type;
      }
    });
    
    return { 
      width: combatState.map.width, 
      height: combatState.map.height, 
      grid,
      seedId: 'FORGE' as const,
    };
  }, [combatState?.map]);

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
          <OrthographicCamera makeDefault position={[40, 40, 40]} zoom={30} near={0.1} far={1000} />
          <CameraControls 
            ref={(node) => {
              if (node) {
                node.addEventListener('rest', onRest);
              } else if (controlsRef.current) {
                controlsRef.current.removeEventListener('rest', onRest);
              }
              (controlsRef as React.MutableRefObject<CameraControlsImpl | null>).current = node;
            }}
            makeDefault
            minZoom={20} 
            maxZoom={100}
            dollyToCursor={true}
            minPolarAngle={0}
            maxPolarAngle={Math.PI * 90 / 180}
            onStart={onStart}
          />
          <ambientLight intensity={0.5} />
          <hemisphereLight args={['#87CEEB', '#654321', 0.6]} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          {gameMap && <UnifiedMapScene mode="combat" map={gameMap} sessionId={sessionId} isCameraMoving={isCameraMoving} />}
        </Canvas>

        <CombatHUD />
      </div>
    </div>
  );
}

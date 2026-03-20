import React, { useEffect, useMemo, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrthographicCamera, CameraControls, Text } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { UnifiedMapScene } from '../game/UnifiedMap/UnifiedMapScene';
import { CombatHUD } from '../game/HUD/CombatHUD';
import { useCombatStore } from '../store/combat.store';
import { useAuthStore } from '../store/auth.store';
import { TerrainType } from '@game/shared-types';
import './CombatPage.css';

/**
 * Pré chargeur d'assets pour éviter les "flashs" lors du premier sort ou déplacement
 */
function CombatPreloader() {
  // Préchargement de toutes les textures possibles des personnages
  useLoader(THREE.TextureLoader, [
    '/assets/sprites/soldier/idle.png',
    '/assets/sprites/soldier/walk.png',
    '/assets/sprites/soldier/attack.png',
    '/assets/sprites/orc/idle.png',
    '/assets/sprites/orc/walk.png',
    '/assets/sprites/orc/attack.png',
  ]);

  // Préchargement de la police de caractères (drei Text utilise Roboto par défaut)
  // On rend un texte invisible pour forcer le chargement immédiat
  return <Text visible={false}>Preload Font</Text>;
}

export function CombatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const combatState = useCombatStore((s) => s.combatState);
  const connectToSession = useCombatStore((s) => s.connectToSession);
  const disconnect = useCombatStore((s) => s.disconnect);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  const logs = useCombatStore((s) => s.logs);

  const authInitialize = useAuthStore((s) => s.initialize);
  const [isCameraMoving, setIsCameraMoving] = React.useState(false);
  const controlsRef = React.useRef<CameraControlsImpl>(null);

  const onRest = React.useCallback(() => setIsCameraMoving(false), []);
  const onStart = React.useCallback(() => setIsCameraMoving(true), []);

  useEffect(() => {
    authInitialize();
  }, [authInitialize]);

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
    <div className="combat-page-container">
      {!combatState && (
        <div className="combat-overlay">
          <div className="loading-spinner"></div>
          <p>Chargement du combat...</p>
        </div>
      )}

      <div className="combat-layout">
        {/* LEFT WINDOW: GAME & HUD */}
        <div className="combat-game-zone">
          <Canvas
            shadows
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 2]}
            camera={{ fov: 30 }}
            onPointerMissed={() => setSelectedSpell(null)}
          >
            <color attach="background" args={['#0f172a']} />
            <OrthographicCamera
              makeDefault
              position={[20, 20, 20]}
              zoom={50}
              near={0.1}
              far={1000}
            />
            <CameraControls 
              ref={controlsRef} 
              onRest={onRest} 
              onStart={onStart}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2.1}
              mouseButtons={{
                left: CameraControlsImpl.ACTION.NONE,
                right: CameraControlsImpl.ACTION.TRUCK,
                middle: CameraControlsImpl.ACTION.NONE,
                wheel: CameraControlsImpl.ACTION.DOLLY
              }}
              dollyToCursor={true}
              minZoom={20} 
              maxZoom={100}
            />
            
            <ambientLight intensity={1.5} />
            <directionalLight
              position={[5, 10, 5]}
              intensity={2}
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-camera-far={50}
              shadow-camera-left={-10}
              shadow-camera-right={10}
              shadow-camera-top={10}
              shadow-camera-bottom={-10}
            />
            
            {/* Préchargement des assets critiques pour éviter les sauts lors des premiers sorts/mouvements */}
            <Suspense fallback={null}>
               <CombatPreloader />
            </Suspense>

            {gameMap && (
              <UnifiedMapScene 
                mode="combat" 
                map={gameMap} 
                sessionId={sessionId} 
                isCameraMoving={isCameraMoving} 
              />
            )}
          </Canvas>

          <CombatHUD />
        </div>

        {/* RIGHT WINDOW: LOGS (Desktop only via CSS) */}
        <div className="combat-logs-side">
            <div className="logs-sidebar-header">Journal de Combat</div>
            <div className="logs-sidebar-content">
               {logs.map((log) => (
                 <div key={log.id} className={`log-entry type-${log.type}`}>
                   <span className="log-msg">{log.message}</span>
                 </div>
               ))}
               {logs.length === 0 && <div className="logs-empty">Aucune action...</div>}
            </div>
        </div>
      </div>
    </div>
  );
}

import { OrthographicCamera, CameraControls, Text } from '@react-three/drei';
import { Canvas, useLoader } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';

import React, { useEffect, useMemo, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as THREE from 'three';

import { TerrainType } from '@game/shared-types';


import { CameraEffects } from '../game/Combat/CameraEffects';
import { CombatBackgroundShader } from '../game/Combat/CombatBackgroundShader';
import { CombatHUD } from '../game/HUD/CombatHUD';
import { UnifiedMapScene } from '../game/UnifiedMap/UnifiedMapScene';
import '../game/constants/colors';
import { CanvasPerfOverlay } from '../perf/CanvasPerfOverlay';
import { ProfiledRegion } from '../perf/render-profiler';
import { useAuthStore } from '../store/auth.store';
import { useCombatStore } from '../store/combat.store';
import { useTranslation } from '../store/language.store';
import { playSfx } from '../utils/sfx';
import { getTimeOfDay } from '../utils/timeOfDay';
import { useGameSession } from './GameTunnel';
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
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const combatState = useCombatStore((s) => s.combatState);
  const winnerId = useCombatStore((s) => s.winnerId);
  const authInitialize = useAuthStore((s) => s.initialize);
  const connectToSession = useCombatStore((s) => s.connectToSession);
  const disconnect = useCombatStore((s) => s.disconnect);

  const [isCameraMoving, setIsCameraMoving] = React.useState(false);
  const controlsRef = React.useRef<CameraControlsImpl>(null);
  const wasLinkedSessionRef = React.useRef(false);

  const { activeSession, refreshSession } = useGameSession();
  const onRest = React.useCallback(() => setIsCameraMoving(false), []);
  const onStart = React.useCallback(() => setIsCameraMoving(true), []);

  // Un pas par case franchie par un pion en combat, alterné A/B.
  const footstepFlipRef = React.useRef(false);
  const handleTileReached = React.useCallback(() => {
    footstepFlipRef.current = !footstepFlipRef.current;
    playSfx(footstepFlipRef.current ? 'footstepA' : 'footstepB');
  }, []);



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

  const mountedAtRef = React.useRef<number>(Date.now());
  const prevGamePhaseRef = React.useRef<string | null>(null);

  // Repli si le SSE game-session arrive en retard : le backend a déjà mis à jour la session
  useEffect(() => {
    if (!winnerId) return;
    void refreshSession({ silent: true });
  }, [winnerId, refreshSession]);

  // Fin de manche : le serveur repasse la game session en FARMING (manche suivante) → retour farming
  useEffect(() => {
    if (activeSession?.id) {
      wasLinkedSessionRef.current = true;
    }

    if (!activeSession) {
      if (wasLinkedSessionRef.current) {
        navigate('/', { replace: true });
      }
      return;
    }
    if (activeSession.status === 'FINISHED') {
      navigate('/', { replace: true });
      prevGamePhaseRef.current = null;
      return;
    }
    const phase = activeSession.phase;
    const combatIdFromUrl = sessionId; 
    const latestCombatId = activeSession.combats?.[0]?.id;
    
    // Si la phase globale repasse en FARMING mais que notre combat est toujours le dernier 
    // et qu'on vient d'arriver (moins de 3s), on reste sur la page pour laisser le temps
    // au state de se stabiliser et au joueur de voir le résultat.
    const isRecentlyMounted = Date.now() - mountedAtRef.current < 3000;

    if (activeSession.status === 'FINISHED' && !isRecentlyMounted) {
      navigate('/', { replace: true });
    }

    // On ignore le passage à FARMING si on est en plein milieu du combat ou si on vient de le lancer
    if (phase === 'FARMING' && latestCombatId === combatIdFromUrl && isRecentlyMounted) {
      console.warn('[CombatPage] Ignoring FARMING phase flip due to recent mount / latest match match');
      return;
    }

    prevGamePhaseRef.current = phase ?? null;
  }, [activeSession, navigate, sessionId]);

  // Construire une GameMap fictive à partir de combatState pour UnifiedMapScene
  const gameMap = useMemo(() => {
    if (!combatState?.map?.tiles) return null;
    
    const grid = Array(combatState.map.height)
      .fill(0)
      .map(() => Array(combatState.map.width).fill(TerrainType.GROUND));
    
    for (const t of combatState.map.tiles) {
      if (grid[t.y] && grid[t.y][t.x] !== undefined) {
        grid[t.y][t.x] = t.type;
      }
    }
    
    return { 
      width: combatState.map.width, 
      height: combatState.map.height, 
      grid,
      seedId: 'FORGE' as const,
    };
  }, [combatState?.map]);

  const timeOfDay = getTimeOfDay(activeSession?.currentRound ?? 1);

  if (!sessionId) return null;

  return (
    <ProfiledRegion id="CombatPage">
    <div className="combat-page-container">

      {!combatState && (
        <div className="combat-overlay">
          <div className="loading-spinner"></div>
          <p>{t('loadingCombat')}</p>
        </div>
      )}

      <div className="combat-layout">
        {/* LEFT WINDOW: GAME & HUD */}
        <div className="combat-game-zone">
          <Canvas
            shadows={{ type: 'pcf' }}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
            camera={{ fov: 30 }}
          >
            <CanvasPerfOverlay />
            <CombatBackgroundShader timeOfDay={timeOfDay} />
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
              minZoom={15}
              maxZoom={80}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2.1}
              minZoom={15}
              maxZoom={120}
              mouseButtons={{
                left: CameraControlsImpl.ACTION.ROTATE,
                right: CameraControlsImpl.ACTION.NONE,
                middle: CameraControlsImpl.ACTION.NONE,
                wheel: CameraControlsImpl.ACTION.ZOOM
              }}
              touches={{
                one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
                two: CameraControlsImpl.ACTION.TOUCH_ZOOM,
                three: CameraControlsImpl.ACTION.NONE
              }}
            />
            
            <CameraEffects controlsRef={controlsRef} />
            
            <ambientLight intensity={1.5} />
            <directionalLight
              position={[5, 10, 5]}
              intensity={2}
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-bias={-0.0004}
              shadow-normalBias={0.04}
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
              <Suspense fallback={null}>
                <UnifiedMapScene
                  mode="combat"
                  map={gameMap}
                  sessionId={sessionId}
                  isCameraMoving={isCameraMoving}
                  timeOfDay={timeOfDay}
                  onTileReached={handleTileReached}
                />
              </Suspense>
            )}
          </Canvas>

          <CombatHUD />
        </div>


      </div>
    </div>
    </ProfiledRegion>
  );
}

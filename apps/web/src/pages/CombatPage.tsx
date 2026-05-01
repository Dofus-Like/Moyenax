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
import { useGameSession } from './GameTunnel';
import { gameSessionApi } from '../api/game-session.api';
import { CombatBackgroundShader } from '../game/Combat/CombatBackgroundShader';
import { CombatDebugMenu } from '../game/Combat/CombatDebugMenu';
import { CameraEffects } from '../game/Combat/CameraEffects';
import '../game/constants/colors';
import { CanvasPerfOverlay } from '../perf/CanvasPerfOverlay';
import { ProfiledRegion } from '../perf/render-profiler';
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
  const winnerId = useCombatStore((s) => s.winnerId);
  const connectToSession = useCombatStore((s) => s.connectToSession);
  const disconnect = useCombatStore((s) => s.disconnect);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  const logs = useCombatStore((s) => s.logs);

  const authInitialize = useAuthStore((s) => s.initialize);
  const surrender = useCombatStore((s) => s.surrender);
  const [isCameraMoving, setIsCameraMoving] = React.useState(false);
  const controlsRef = React.useRef<CameraControlsImpl>(null);
  const wasLinkedSessionRef = React.useRef(false);

  const { activeSession, refreshSession } = useGameSession();
  const onRest = React.useCallback(() => setIsCameraMoving(false), []);
  const onStart = React.useCallback(() => setIsCameraMoving(true), []);

  const handleEndSession = React.useCallback(async () => {
    if (!activeSession) return;
    const ok = window.confirm("Êtes-vous sûr de vouloir abandonner la partie ? Cela mettra fin au match pour tous les joueurs.");
    if (!ok) return;

    try {
      await gameSessionApi.endSession(activeSession.id);
      await refreshSession({ silent: true });
      navigate('/');
    } catch (error) {
      console.error('Erreur fin session:', error);
    }
  }, [activeSession, refreshSession, navigate]);

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

    console.log(`[CombatPage] Phase monitor [UrlId: ${combatIdFromUrl}, LatestId: ${latestCombatId}]: phase=${phase}, status=${activeSession.status}, isRecentlyMounted=${isRecentlyMounted}`);

    if (activeSession.status === 'FINISHED' && !isRecentlyMounted) {
      console.log('[CombatPage] Session completely finished, redirecting to root');
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
    <ProfiledRegion id="CombatPage">
      <div className="combat-page-container">
        <CombatDebugMenu />
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
              <CanvasPerfOverlay />
              <CombatBackgroundShader />
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
              />

              <CameraEffects controlsRef={controlsRef} />

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
                <Suspense fallback={null}>
                  <UnifiedMapScene
                    mode="combat"
                    map={gameMap}
                    sessionId={sessionId}
                    isCameraMoving={isCameraMoving}
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

import { OrthographicCamera, CameraControls, Text } from '@react-three/drei';
import { Canvas, useLoader } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { TerrainType } from '@game/shared-types';

import { playgroundApi } from '../api/playground.api';
import { CameraEffects } from '../game/Combat/CameraEffects';
import { CombatBackgroundShader } from '../game/Combat/CombatBackgroundShader';
import { CombatHUD } from '../game/HUD/CombatHUD';
import { EquipmentPanel } from '../game/Playground/EquipmentPanel';
import { TerrainBrushPanel, type PlaygroundMode } from '../game/Playground/TerrainBrushPanel';
import { UnifiedMapScene } from '../game/UnifiedMap/UnifiedMapScene';
import '../game/constants/colors';
import { useAuthStore } from '../store/auth.store';
import { useCombatStore } from '../store/combat.store';
import { getTimeOfDay } from '../utils/timeOfDay';

import './CombatPage.css';

function CombatPreloader() {
  useLoader(THREE.TextureLoader, [
    '/assets/sprites/soldier/idle.png',
    '/assets/sprites/soldier/walk.png',
    '/assets/sprites/soldier/attack.png',
    '/assets/sprites/orc/idle.png',
    '/assets/sprites/orc/walk.png',
    '/assets/sprites/orc/attack.png',
  ]);
  return <Text visible={false}>Preload Font</Text>;
}

export function PlaygroundPage() {
  const combatState = useCombatStore((s) => s.combatState);
  const winnerId = useCombatStore((s) => s.winnerId);
  const connectToSession = useCombatStore((s) => s.connectToSession);
  const disconnect = useCombatStore((s) => s.disconnect);
  const setCombatState = useCombatStore((s) => s.setCombatState);
  const authInitialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.player);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [arena, setArena] = useState<'sandbox' | 'combat'>('sandbox');
  const [mode, setMode] = useState<PlaygroundMode>('play');
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>(TerrainType.WOOD);
  const [switching, setSwitching] = useState(false);
  const controlsRef = useRef<CameraControlsImpl>(null);
  const isSandbox = arena === 'sandbox';
  // Démarrage idempotent : StrictMode invoque l'effet deux fois, mais on ne doit
  // créer qu'une seule session (sinon collision sur l'index unique combat public).
  const startedRef = useRef(false);
  const userId = user?.id ?? (user as { _id?: string } | null)?._id ?? undefined;
  const combatEnded = arena === 'combat' && !!winnerId && !switching;
  const isWinner = !!userId && winnerId === userId;

  useEffect(() => {
    const boot = async () => {
      if (startedRef.current) return;
      startedRef.current = true;
      try {
        await authInitialize();
        const { data } = await playgroundApi.start();
        setSessionId(data.sessionId);
        connectToSession(data.sessionId);
      } catch (error) {
        console.error('Playground boot failed', error);
      }
    };
    void boot();
    return () => {
      disconnect();
    };
  }, [authInitialize, connectToSession, disconnect]);

  const switchArena = useCallback(
    async (target: 'sandbox' | 'combat') => {
      setSwitching(true);
      try {
        disconnect();
        const { data } =
          target === 'combat'
            ? await playgroundApi.startCombat()
            : await playgroundApi.start();
        setArena(target);
        setMode('play');
        setSessionId(data.sessionId);
        connectToSession(data.sessionId);
      } catch (error) {
        console.error('Playground arena switch failed', error);
      } finally {
        setSwitching(false);
      }
    },
    [connectToSession, disconnect],
  );

  const handlePlaygroundTileClick = useCallback(
    async (x: number, y: number) => {
      if (!sessionId || arena !== 'sandbox') return;
      try {
        if (mode === 'paint') {
          const { data } = await playgroundApi.paint(sessionId, { x, y, terrain: selectedTerrain });
          setCombatState(data);
        } else if (mode === 'gather') {
          const { data } = await playgroundApi.gather(sessionId, { x, y });
          setCombatState(data);
        }
      } catch (error) {
        console.error('Playground tile action failed', error);
      }
    },
    [mode, selectedTerrain, sessionId, setCombatState],
  );

  const gameMap = useMemo(() => {
    if (!combatState?.map?.tiles) return null;
    const grid = Array(combatState.map.height)
      .fill(0)
      .map(() => Array(combatState.map.width).fill(TerrainType.GROUND));
    for (const t of combatState.map.tiles) {
      if (grid[t.y] && grid[t.y][t.x] !== undefined) grid[t.y][t.x] = t.type;
    }
    return {
      width: combatState.map.width,
      height: combatState.map.height,
      grid,
      seedId: 'FORGE' as const,
    };
  }, [combatState?.map]);

  const timeOfDay = getTimeOfDay(1);

  return (
    <div className="combat-page-container">
      {!combatState && (
        <div className="combat-overlay">
          <div className="loading-spinner"></div>
          <p>Préparation du playground…</p>
        </div>
      )}

      <div className="combat-layout">
        <div className="combat-game-zone">
          <Canvas
            shadows={{ type: THREE.PCFShadowMap }}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
            camera={{ fov: 30 }}
          >
            <CombatBackgroundShader timeOfDay={timeOfDay} />
            <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={50} near={0.1} far={1000} />
            <CameraControls
              ref={controlsRef}
              minZoom={15}
              maxZoom={120}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2.1}
              mouseButtons={{
                left: CameraControlsImpl.ACTION.ROTATE,
                right: CameraControlsImpl.ACTION.NONE,
                middle: CameraControlsImpl.ACTION.NONE,
                wheel: CameraControlsImpl.ACTION.ZOOM,
              }}
              touches={{
                one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
                two: CameraControlsImpl.ACTION.TOUCH_ZOOM,
                three: CameraControlsImpl.ACTION.NONE,
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
            <Suspense fallback={null}>
              <CombatPreloader />
            </Suspense>
            {gameMap && sessionId && (
              <Suspense fallback={null}>
                <UnifiedMapScene
                  mode="combat"
                  map={gameMap}
                  sessionId={sessionId}
                  timeOfDay={timeOfDay}
                  playgroundMode={isSandbox ? mode : 'play'}
                  onPlaygroundTileClick={handlePlaygroundTileClick}
                />
              </Suspense>
            )}
          </Canvas>

          <CombatHUD />

          <div className="pg-arena-bar">
            <button
              type="button"
              className={`pg-arena-toggle${isSandbox ? '' : ' is-combat'}`}
              disabled={switching}
              onClick={() => switchArena(isSandbox ? 'combat' : 'sandbox')}
            >
              {isSandbox ? '⚔️ Lancer un vrai combat' : '🧪 Retour au bac à sable'}
            </button>
            <span className="pg-arena-label">
              {isSandbox ? 'Bac à sable — sans tours, PA/PM illimités' : 'Combat tour par tour vs IA'}
            </span>
          </div>

          {sessionId && isSandbox && (
            <>
              <TerrainBrushPanel
                mode={mode}
                onModeChange={setMode}
                selectedTerrain={selectedTerrain}
                onTerrainChange={setSelectedTerrain}
              />
              <EquipmentPanel sessionId={sessionId} />
            </>
          )}

          {combatEnded && (
            <div className={`pg-end-overlay ${isWinner ? 'is-victory' : 'is-defeat'}`}>
              <div className="pg-end-card">
                <h2 className="pg-end-title">{isWinner ? '🏆 Victoire' : '💀 Défaite'}</h2>
                <div className="pg-end-actions">
                  <button
                    type="button"
                    className="pg-arena-toggle"
                    disabled={switching}
                    onClick={() => switchArena('combat')}
                  >
                    ⚔️ Rejouer
                  </button>
                  <button
                    type="button"
                    className="pg-arena-toggle is-combat"
                    disabled={switching}
                    onClick={() => switchArena('sandbox')}
                  >
                    🧪 Retour au bac à sable
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

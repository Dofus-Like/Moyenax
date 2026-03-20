import { CameraControls, OrthographicCamera } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Canvas } from '@react-three/fiber';
import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { FarmingHUD } from '../game/HUD/FarmingHUD';
import { UnifiedMapScene } from '../game/UnifiedMap/UnifiedMapScene';
import { useAutoHarvest } from '../game/UnifiedMap/hooks/useAutoHarvest';
import { useFarmingStore } from '../store/farming.store';
import {
  TerrainType,
  TERRAIN_PROPERTIES,
  TERRAIN_LABELS,
  SEED_CONFIGS,
  SeedId,
  PathNode,
  findPath,
  findPathToAdjacent,
} from '@game/shared-types';
import './ResourceMapPage.css';

function findSpawnPosition(grid: TerrainType[][]): PathNode {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (TERRAIN_PROPERTIES[grid[y][x]].traversable) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}

export function FarmingPage() {
  const navigate = useNavigate();
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; terrain: TerrainType } | null>(null);
  const [movePath, setMovePath] = useState<PathNode[] | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [queuedAction, setQueuedAction] = useState<{ type: 'gather'; x: number; y: number } | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  const [searchParams] = useSearchParams();
  const isDebugMode = searchParams.get('debug') === 'true';

  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const map = useFarmingStore((s) => s.map);
  const playerPosition = useFarmingStore((s) => s.playerPosition);
  const movePlayer = useFarmingStore((s) => s.movePlayer);
  const inventory = useFarmingStore((s) => s.inventory);
  const fetchState = useFarmingStore((s) => s.fetchState);
  const gatherNode = useFarmingStore((s) => s.gatherNode);
  const debugRefill = useFarmingStore((s) => s.debugRefill);
  const nextRound = useFarmingStore((s) => s.nextRound);
  const round = useFarmingStore((s) => s.round);
  const isLoading = useFarmingStore((s) => s.isLoading);

  const showActionMessage = useCallback((text: string, type: 'info' | 'error' = 'error') => {
    setActionMessage({ text, type });
  }, []);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => setActionMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  const seedConfig = useMemo(() => {
    if (!map) return null;
    return SEED_CONFIGS[map.seedId as SeedId] ?? null;
  }, [map]);

  const currentPlayerPos = useMemo(() => {
    if (playerPosition) return playerPosition;
    if (map) return findSpawnPosition(map.grid);
    return { x: 0, y: 0 };
  }, [playerPosition, map]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const [controls, setControls] = useState<CameraControlsImpl | null>(null);

  useEffect(() => {
    if (!controls) return;
    let timeoutId: NodeJS.Timeout;

    const start = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setIsCameraMoving(true);
    };

    const end = () => {
      // On attend un court instant (300ms) avant de réactiver le hover
      // Cela couvre l'inertie de la caméra et évite les stutters de "fin de clic"
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsCameraMoving(false);
      }, 300);
    };

    const immediateEnd = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setIsCameraMoving(false);
    };

    controls.addEventListener('controlstart', start);
    controls.addEventListener('controlend', end);
    controls.addEventListener('rest', immediateEnd);

    controls.mouseButtons.left = CameraControlsImpl.ACTION.NONE;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      controls.removeEventListener('controlstart', start);
      controls.removeEventListener('controlend', end);
      controls.removeEventListener('rest', immediateEnd);
    };
  }, [controls]); 

  useEffect(() => {
    if (map && !playerPosition) {
      const spawn = findSpawnPosition(map.grid);
      movePlayer(spawn);
    }
  }, [map, playerPosition, movePlayer]);

  const previewPath = useMemo(() => {
    if (!map || !hoverInfo) return [];
    const target = { x: hoverInfo.x, y: hoverInfo.y };
    if (target.x === currentPlayerPos.x && target.y === currentPlayerPos.y) return [];
    
    if (TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable) {
       return findPathToAdjacent(map, currentPlayerPos, target) ?? [];
    }

    if (!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable) return [];
    return findPath(map, currentPlayerPos, target) ?? [];
  }, [map, hoverInfo, currentPlayerPos, isMoving]);

  const handleTileClick = useCallback(
    (x: number, y: number, terrain: TerrainType) => {
      if (!map || isMoving) return;
      if (x === currentPlayerPos.x && y === currentPlayerPos.y) return;

      const props = TERRAIN_PROPERTIES[terrain];
      const isAdjacent = Math.abs(currentPlayerPos.x - x) + Math.abs(currentPlayerPos.y - y) <= 1;

      if (props.harvestable) {
        if (isAdjacent) {
          gatherNode(x, y).catch((error) => {
            console.error(error);
            showActionMessage('Récolte impossible sur cette case.', 'error');
          });
        } else {
          const adjacentTiles = [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 },
          ].filter(t => 
            t.x >= 0 && t.x < map.width && 
            t.y >= 0 && t.y < map.height && 
            TERRAIN_PROPERTIES[map.grid[t.y][t.x]].traversable
          );

          if (adjacentTiles.length === 0) {
            showActionMessage('Aucune case accessible autour de cette ressource.', 'error');
            return;
          }

          const closestTile = adjacentTiles.reduce((prev, curr) => {
            const distPrev = Math.abs(prev.x - currentPlayerPos.x) + Math.abs(prev.y - currentPlayerPos.y);
            const distCurr = Math.abs(curr.x - currentPlayerPos.x) + Math.abs(curr.y - currentPlayerPos.y);
            return distCurr < distPrev ? curr : prev;
          }, adjacentTiles[0]);

          const bestPath = findPath(map, currentPlayerPos, closestTile);

          if (bestPath && bestPath.length > 0) {
            setMovePath(bestPath);
            setQueuedAction({ type: 'gather', x, y });
            setIsMoving(true);
          } else {
            showActionMessage('Aucun chemin valide vers cette ressource.', 'error');
          }
        }
        return;
      }

      if (!props.traversable) return;

      const path = findPath(map, currentPlayerPos, { x, y });
      if (path && path.length > 0) {
        setMovePath(path);
        setQueuedAction(null);
        setIsMoving(true);
      }
    },
    [map, isMoving, currentPlayerPos, gatherNode]
  );

  const handlePathComplete = useCallback(() => {
    if (movePath && movePath.length > 0) {
      const last = movePath[movePath.length - 1];
      movePlayer({ x: last.x, y: last.y });
      
      if (queuedAction?.type === 'gather') {
        gatherNode(queuedAction.x, queuedAction.y).catch((error) => {
          console.error(error);
          showActionMessage('Récolte impossible après déplacement.', 'error');
        });
      }
    }
    setMovePath(null);
    setQueuedAction(null);
    setIsMoving(false);
  }, [movePath, movePlayer, queuedAction, gatherNode, showActionMessage]);

  const handleTileHover = useCallback((info: { x: number; y: number; terrain: TerrainType } | null) => {
    setHoverInfo(info);
  }, []);

  const handleNextRound = useCallback(async () => {
    try {
      if (isDebugMode) {
        await debugRefill();
        showActionMessage('Pips restaurés.', 'info');
      } else {
        await nextRound();
        const currentRound = useFarmingStore.getState().round;
        if (currentRound > 5) {
          navigate('/lobby'); // Transition vers PvP
        } else {
          navigate('/crafting'); // Transition vers Shop/Craft
        }
      }
    } catch (e) {
      console.error(e);
      showActionMessage('Impossible de terminer la manche.', 'error');
    }
  }, [isDebugMode, debugRefill, nextRound, navigate, showActionMessage]);

  const currentTerrain = map ? map.grid[currentPlayerPos.y]?.[currentPlayerPos.x] : TerrainType.GROUND;
  useAutoHarvest({
    currentPosition: currentPlayerPos,
    terrain: currentTerrain,
  });

  const totalResources = useMemo(() => {
    return Object.values(inventory).reduce((sum, count) => (sum as number) + (count as number), 0);
  }, [inventory]);

  return (
    <div className="resource-map-container">
      <header className="resource-map-header">
        <button className="back-button" onClick={() => navigate('/')}>
          Retour
        </button>
        <button className="inventory-button" onClick={() => navigate('/inventory')} style={{ marginLeft: '10px', background: '#444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
          🎒 Inventaire
        </button>
        <h2>Mode Farming</h2>
        {seedConfig && (
          <div className="seed-badge">
            {seedConfig.label} — {seedConfig.dominantBuild}
          </div>
        )}
        <div className="map-legend">
          <span className="legend-item legend-ground">Sol</span>
          <span className="legend-item legend-iron">Fer</span>
          <span className="legend-item legend-leather">Cuir</span>
          <span className="legend-item legend-crystal">Cristal</span>
          <span className="legend-item legend-fabric">Étoffe</span>
          <span className="legend-item legend-wood">Bois</span>
          <span className="legend-item legend-herb">Herbe</span>
          <span className="legend-item legend-gold">Or</span>
        </div>
        <div className="round-info" style={{ marginLeft: '20px', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
          Manche {round} / 5
        </div>
        <button className="harvest-end-btn" onClick={handleNextRound} style={{ marginLeft: 'auto', background: 'var(--color-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          {isDebugMode ? 'Debug Refill' : 'Terminer la manche'}
        </button>
      </header>

      <div className="resource-map-canvas">
        <FarmingHUD />
        {actionMessage && (
          <div className={`map-action-toast ${actionMessage.type}`}>
            {actionMessage.text}
          </div>
        )}
        {!map && <div className="map-loading">Chargement de la carte...</div>}
        {map && (
          <Canvas>
            <OrthographicCamera makeDefault position={[15, 20, 15]} zoom={30} near={0.1} far={100} />
            <CameraControls
              ref={setControls}
              makeDefault
              minZoom={15}
              maxZoom={80}
              dollyToCursor={true}
              infinityDolly={false}
              minPolarAngle={0}
              maxPolarAngle={Math.PI * 90 / 180}
              onStart={() => setIsCameraMoving(true)}
            />
            <ambientLight intensity={0.5} />
            <hemisphereLight args={['#87CEEB', '#654321', 0.6]} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
            <color attach="background" args={['#0a0e17']} />
            <Suspense fallback={null}>
              <UnifiedMapScene 
                mode="farming" 
                map={map} 
                playerPosition={playerPosition || undefined}
                movePath={movePath}
                previewPath={previewPath}
                onPathComplete={handlePathComplete}
                onTileClick={handleTileClick}
                onTileHover={handleTileHover}
                isCameraMoving={isCameraMoving}
                isMoving={isMoving}
              />
            </Suspense>
          </Canvas>
        )}

        <div className="tile-info-panel">
          <div className="inventory-section">
            <h3>Inventaire ({totalResources})</h3>
            {Object.keys(inventory).length === 0 ? (
              <p className="inventory-empty">Aucune ressource</p>
            ) : (
              <ul className="inventory-list">
                {Object.entries(inventory).map(([resource, count]) => (
                  <li key={resource}>
                    {resource}: <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <hr />
          {hoverInfo ? (
            <>
              <div className="tile-info-title">{TERRAIN_LABELS[hoverInfo.terrain]}</div>
              <div className="tile-info-coords">Case ({hoverInfo.x}, {hoverInfo.y})</div>
              {previewPath.length > 0 && <div className="tile-info-distance">Distance : {previewPath.length} cases</div>}
              {TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable && <div className="tile-info-resource">Ressource : {TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName}</div>}
              {!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable && <div className="tile-info-blocked">Inaccessible</div>}
            </>
          ) : (
            <div className="tile-info-empty">Survolez une case</div>
          )}
        </div>
      </div>
    </div>
  );
}

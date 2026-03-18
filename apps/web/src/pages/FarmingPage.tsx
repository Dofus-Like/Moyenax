import { CameraControls, OrthographicCamera } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Canvas } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

  const [searchParams] = useSearchParams();
  const isDebugMode = searchParams.get('debug') === 'true';

  const { map, playerPosition, movePlayer, inventory, fetchState, gatherNode, endPhase, debugRefill } = useFarmingStore();
  const controlsRef = useRef<CameraControlsImpl>(null);

  const seedConfig = useMemo(() => {
    if (!map) return null;
    return SEED_CONFIGS[map.seedId as SeedId] ?? null;
  }, [map]);

  const currentPlayerPos = useMemo(() => {
    if (playerPosition) return playerPosition;
    if (map) return findSpawnPosition(map.grid);
    return { x: 0, y: 0 };
  }, [playerPosition, map]);

  // Fetch initial farming state on mount
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK;
      controlsRef.current.mouseButtons.right = CameraControlsImpl.ACTION.ROTATE;
    }
  }, []);

  // Initialiser la position du joueur au premier chargement
  useEffect(() => {
    if (map && !playerPosition) {
      const spawn = findSpawnPosition(map.grid);
      movePlayer(spawn);
    }
  }, [map, playerPosition, movePlayer]);

  const previewPath = useMemo(() => {
    if (!map || !hoverInfo || isMoving) return [];
    const target = { x: hoverInfo.x, y: hoverInfo.y };
    if (target.x === currentPlayerPos.x && target.y === currentPlayerPos.y) return [];
    
    if (TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable) {
       const adjacentTiles = [
         { x: target.x + 1, y: target.y },
         { x: target.x - 1, y: target.y },
         { x: target.x, y: target.y + 1 },
         { x: target.x, y: target.y - 1 },
       ].filter(t => 
         t.x >= 0 && t.x < map.width && 
         t.y >= 0 && t.y < map.height && 
         TERRAIN_PROPERTIES[map.grid[t.y][t.x]].traversable
       );

       let bestPath: PathNode[] | null = null;
       for (const t of adjacentTiles) {
         if (t.x === currentPlayerPos.x && t.y === currentPlayerPos.y) {
            return []; // Déjà adjacent, pas besoin de bouger
         }
         const p = findPath(map, currentPlayerPos, t);
         if (p && (!bestPath || p.length < bestPath.length)) {
            bestPath = p;
         }
       }
       return bestPath ?? [];
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

      // Handle Gathering
      if (props.harvestable) {
        if (isAdjacent) {
          gatherNode(x, y).catch(console.error);
        } else {
          // Find path to closest adjacent tile
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

          let bestPath: PathNode[] | null = null;
          for (const t of adjacentTiles) {
            const p = findPath(map, currentPlayerPos, t);
            if (p && (!bestPath || p.length < bestPath.length)) {
              bestPath = p;
            }
          }

          if (bestPath && bestPath.length > 0) {
            setMovePath(bestPath);
            setQueuedAction({ type: 'gather', x, y });
            setIsMoving(true);
          }
        }
        return;
      }

      // Handle Movement
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
        gatherNode(queuedAction.x, queuedAction.y).catch(console.error);
      }
    }
    setMovePath(null);
    setQueuedAction(null);
    setIsMoving(false);
  }, [movePath, movePlayer, queuedAction, gatherNode]);

  const handleTileHover = useCallback((info: { x: number; y: number; terrain: TerrainType } | null) => {
    setHoverInfo(info);
  }, []);

  const handleEndHarvest = useCallback(async () => {
    try {
      if (isDebugMode) {
        await debugRefill();
      } else {
        await endPhase();
        navigate('/'); // On retourne au lobby temporairement en attendant le vrai module combat
      }
    } catch (e) {
      console.error(e);
    }
  }, [isDebugMode, debugRefill, endPhase, navigate]);

  // Auto-récolte quand le joueur arrive sur une ressource
  const currentTerrain = map ? map.grid[currentPlayerPos.y]?.[currentPlayerPos.x] : TerrainType.GROUND;
  useAutoHarvest({
    currentPosition: currentPlayerPos,
    terrain: currentTerrain,
  });

  const totalResources = useMemo(() => {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
  }, [inventory]);

  return (
    <div className="resource-map-container">
      <header className="resource-map-header">
        <button className="back-button" onClick={() => navigate('/')}>
          Retour
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
        <button 
          className="harvest-end-btn" 
          onClick={handleEndHarvest}
          style={{
            marginLeft: 'auto',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'background 0.2s'
          }}
        >
          {isDebugMode ? 'Fin de la récolte (Refill Debug)' : 'Fin de la récolte'}
        </button>
      </header>

      <div className="resource-map-canvas">
        <FarmingHUD />
        {!map && <div className="map-loading">Chargement de la carte...</div>}
        {map && (
          <Canvas>
            <OrthographicCamera makeDefault position={[15, 20, 15]} zoom={30} near={0.1} far={100} />
            <CameraControls
              ref={controlsRef}
              makeDefault
              minZoom={15}
              maxZoom={80}
              dollyToCursor={true}
              infinityDolly={false}
            />
            <ambientLight intensity={0.5} />
            <hemisphereLight args={['#87CEEB', '#654321', 0.6]} />
            <directionalLight
              position={[10, 15, 10]}
              intensity={1.2}
            />
            <color attach="background" args={['#0a0e17']} />
            <UnifiedMapScene
              mode="farming"
              map={map}
              playerPosition={currentPlayerPos}
              movePath={movePath}
              previewPath={previewPath}
              onPathComplete={handlePathComplete}
              onTileClick={handleTileClick}
              onTileHover={handleTileHover}
            />
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
              <div className="tile-info-coords">
                Case ({hoverInfo.x}, {hoverInfo.y})
              </div>
              {previewPath.length > 0 && (
                <div className="tile-info-distance">
                  Distance : {previewPath.length} case{previewPath.length > 1 ? 's' : ''}
                </div>
              )}
              {TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable && (
                <div className="tile-info-resource">
                  Ressource : {TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName}
                </div>
              )}
              {!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable && (
                <div className="tile-info-blocked">Inaccessible</div>
              )}
            </>
          ) : (
            <div className="tile-info-empty">Survolez une case</div>
          )}
        </div>
      </div>
    </div>
  );
}

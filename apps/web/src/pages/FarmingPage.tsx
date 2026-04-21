import { CameraControls, OrthographicCamera } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Canvas } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UnifiedMapScene } from '../game/UnifiedMap/UnifiedMapScene';
import { gameSessionApi } from '../api/game-session.api';
import { useAuthStore } from '../store/auth.store';
import { useFarmingStore } from '../store/farming.store';
import { useGameSession } from './GameTunnel';
import {
  type PathNode,
  type SeedId,
  findPath,
  findPathToAdjacent,
  SEED_CONFIGS,
  TERRAIN_LABELS,
  TerrainType,
  TERRAIN_PROPERTIES,
} from '@game/shared-types';
import './ResourceMapPage.css';

const LEGEND_ITEMS = [
  { key: 'ground', label: 'Sol', className: 'legend-ground' },
  { key: 'iron', label: 'Fer', className: 'legend-iron' },
  { key: 'leather', label: 'Cuir', className: 'legend-leather' },
  { key: 'crystal', label: 'Cristal', className: 'legend-crystal' },
  { key: 'fabric', label: 'Etoffe', className: 'legend-fabric' },
  { key: 'wood', label: 'Bois', className: 'legend-wood' },
  { key: 'herb', label: 'Herbe', className: 'legend-herb' },
  { key: 'gold', label: 'Or', className: 'legend-gold' },
] as const;

function findSpawnPosition(grid: TerrainType[][]): PathNode {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      if (TERRAIN_PROPERTIES[grid[y][x]].traversable) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: 0 };
}

export function FarmingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const player = useAuthStore((s) => s.player);
  const refreshPlayer = useAuthStore((s) => s.refreshPlayer);
  const { activeSession, refreshSession } = useGameSession();
  const currentPlayerId = player?.id;
  const isDebugMode = searchParams.get('debug') === 'true';

  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; terrain: TerrainType } | null>(null);
  const [movePath, setMovePath] = useState<PathNode[] | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const [queuedAction, setQueuedAction] = useState<{ type: 'gather'; x: number; y: number } | null>(
    null,
  );
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(
    null,
  );
  const [controls, setControls] = useState<CameraControlsImpl | null>(null);
  const [isGathering, setIsGathering] = useState(false);

  const map = useFarmingStore((s) => s.map);
  const playerPosition = useFarmingStore((s) => s.playerPosition);
  const movePlayer = useFarmingStore((s) => s.movePlayer);
  const inventory = useFarmingStore((s) => s.inventory);
  const fetchState = useFarmingStore((s) => s.fetchState);
  const gatherNode = useFarmingStore((s) => s.gatherNode);
  const round = useFarmingStore((s) => s.round);
  const pips = useFarmingStore((s) => s.pips);
  const [isTransitioningToCrafting, setIsTransitioningToCrafting] = useState(false);

  const showActionMessage = useCallback((text: string, type: 'info' | 'error' = 'error') => {
    setActionMessage({ text, type });
  }, []);

  useEffect(() => {
    if (!actionMessage) {
      return;
    }

    const timer = window.setTimeout(() => setActionMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  const seedConfig = useMemo(() => {
    if (!map) {
      return null;
    }

    return SEED_CONFIGS[map.seedId as SeedId] ?? null;
  }, [map]);

  const filteredLegend = useMemo(() => {
    if (!seedConfig) return LEGEND_ITEMS;
    return LEGEND_ITEMS.filter((item) => {
      if (item.key === 'ground') return true;
      const terrainType = item.key.toUpperCase() as TerrainType;
      return seedConfig.resources.includes(terrainType);
    });
  }, [seedConfig]);

  const currentPlayerPos = useMemo(() => {
    if (playerPosition) {
      return playerPosition;
    }

    if (map) {
      return findSpawnPosition(map.grid);
    }

    return { x: 0, y: 0 };
  }, [map, playerPosition]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!controls) {
      return;
    }

    let timeoutId: number | undefined;

    const start = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      setIsCameraMoving(true);
    };

    const end = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => setIsCameraMoving(false), 300);
    };

    const immediateEnd = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      setIsCameraMoving(false);
    };

    controls.addEventListener('controlstart', start);
    controls.addEventListener('controlend', end);
    controls.addEventListener('rest', immediateEnd);
    controls.mouseButtons.left = CameraControlsImpl.ACTION.NONE;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      controls.removeEventListener('controlstart', start);
      controls.removeEventListener('controlend', end);
      controls.removeEventListener('rest', immediateEnd);
    };
  }, [controls]);

  useEffect(() => {
    if (map && !playerPosition) {
      movePlayer(findSpawnPosition(map.grid));
    }
  }, [map, movePlayer, playerPosition]);

  const syncSpendableGold = useCallback(async () => {
    if (activeSession) {
      await refreshSession({ silent: true });
      return;
    }

    await refreshPlayer();
  }, [activeSession, refreshPlayer, refreshSession]);

  const performGather = useCallback(
    async (x: number, y: number) => {
      if (isGathering) return;
      setIsGathering(true);
      try {
        const previousPips = useFarmingStore.getState().pips;
        const nextState = await gatherNode(x, y);
        if (activeSession) {
          await refreshSession({ silent: false });
          return;
        }
        await refreshPlayer();

        if (!nextState || isDebugMode || previousPips <= 0 || nextState.pips !== 0 || isTransitioningToCrafting) {
          return;
        }

        setIsTransitioningToCrafting(true);
        navigate('/crafting');
      } finally {
        setIsGathering(false);
      }
    },
    [gatherNode, isDebugMode, isTransitioningToCrafting, navigate, syncSpendableGold, isGathering, activeSession, refreshSession, refreshPlayer],
  );

  const previewPath = useMemo(() => {
    if (!map || !hoverInfo) {
      return [];
    }

    const target = { x: hoverInfo.x, y: hoverInfo.y };
    if (target.x === currentPlayerPos.x && target.y === currentPlayerPos.y) {
      return [];
    }

    if (TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable) {
      return findPathToAdjacent(map, currentPlayerPos, target) ?? [];
    }

    if (!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable) {
      return [];
    }

    return findPath(map, currentPlayerPos, target) ?? [];
  }, [currentPlayerPos, hoverInfo, map]);

  const handleTileClick = useCallback(
    (x: number, y: number, terrain: TerrainType) => {
      if (!map) {
        return;
      }

      if (x === currentPlayerPos.x && y === currentPlayerPos.y) {
        return;
      }

      const props = TERRAIN_PROPERTIES[terrain];
      const isAdjacent = Math.abs(currentPlayerPos.x - x) + Math.abs(currentPlayerPos.y - y) <= 1;

      if (props.harvestable) {
        if (isAdjacent) {
          void performGather(x, y).catch((error) => {
            console.error(error);
            showActionMessage('Recolte impossible sur cette case.', 'error');
          });
          return;
        }

        const adjacentTiles = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ].filter(
          (tile) =>
            tile.x >= 0 &&
            tile.x < map.width &&
            tile.y >= 0 &&
            tile.y < map.height &&
            TERRAIN_PROPERTIES[map.grid[tile.y][tile.x]].traversable,
        );

        if (adjacentTiles.length === 0) {
          showActionMessage('Aucune case accessible autour de cette ressource.', 'error');
          return;
        }

        const closestTile = adjacentTiles.reduce((prev, curr) => {
          const prevDistance = Math.abs(prev.x - currentPlayerPos.x) + Math.abs(prev.y - currentPlayerPos.y);
          const currDistance = Math.abs(curr.x - currentPlayerPos.x) + Math.abs(curr.y - currentPlayerPos.y);
          return currDistance < prevDistance ? curr : prev;
        }, adjacentTiles[0]);

        const bestPath = findPath(map, currentPlayerPos, closestTile);
        if (!bestPath || bestPath.length === 0) {
          showActionMessage('Aucun chemin valide vers cette ressource.', 'error');
          return;
        }

        setMovePath(bestPath);
        setQueuedAction({ type: 'gather', x, y });
        setIsMoving(true);
        return;
      }

      if (!props.traversable) {
        return;
      }

      const path = findPath(map, currentPlayerPos, { x, y });
      if (!path || path.length === 0) {
        return;
      }

      setMovePath(path);
      setQueuedAction(null);
      setIsMoving(true);
    },
    [currentPlayerPos, map, performGather, showActionMessage],
  );

  const handleTileReached = useCallback((node: PathNode) => {
    movePlayer(node);
  }, [movePlayer]);

  const handlePathComplete = useCallback(() => {
    if (movePath && movePath.length > 0) {
      const last = movePath[movePath.length - 1];
      movePlayer({ x: last.x, y: last.y });

      if (queuedAction?.type === 'gather') {
        void performGather(queuedAction.x, queuedAction.y).catch((error) => {
          console.error(error);
          showActionMessage('Recolte impossible apres deplacement.', 'error');
        });
      }
    }

    setMovePath(null);
    setQueuedAction(null);
    setIsMoving(false);
  }, [movePath, movePlayer, performGather, queuedAction, showActionMessage]);

  const handleTileHover = useCallback((info: { x: number; y: number; terrain: TerrainType } | null) => {
    setHoverInfo(info);
  }, []);


  const handleEndSession = useCallback(async () => {
    if (!activeSession) {
      return;
    }

    const ok = window.confirm(
      'Etes-vous sur de vouloir abandonner la partie ? Cela mettra fin au match pour tous les joueurs.',
    );

    if (!ok) {
      return;
    }

    try {
      await gameSessionApi.endSession(activeSession.id);
      await refreshSession({ silent: true });
      navigate('/');
    } catch (error) {
      console.error('Erreur fin de session:', error);
    }
  }, [activeSession, navigate, refreshSession]);

  const handleToggleReady = useCallback(async () => {
    if (!activeSession) {
      return;
    }

    if (activeSession.phase === 'FIGHTING') {
      const latestCombat = activeSession.combats?.length ? activeSession.combats[0] : undefined;
      if (latestCombat?.status === 'ACTIVE') {
        navigate(`/combat/${latestCombat.id}`);
        return;
      }
      await refreshSession({ silent: false });
      return;
    }

    try {
      const isReady =
        activeSession.player1Id === currentPlayerId ? activeSession.player1Ready : activeSession.player2Ready;
      await gameSessionApi.toggleReady(!isReady, activeSession.id);
      await refreshSession({ silent: false });
    } catch (error) {
      console.error('Erreur toggle ready:', error);
    }
  }, [activeSession, currentPlayerId, refreshSession, navigate]);

  const combatListRefreshKey = useRef<string | null>(null);
  useEffect(() => {
    if (activeSession?.phase !== 'FIGHTING') {
      combatListRefreshKey.current = null;
      return;
    }

    if (activeSession.combats && activeSession.combats.length > 0) {
      return;
    }

    const key = `${activeSession.id}-${activeSession.currentRound}`;
    if (combatListRefreshKey.current === key) {
      return;
    }

    combatListRefreshKey.current = key;
    void refreshSession({ silent: true });
  }, [activeSession?.combats, activeSession?.currentRound, activeSession?.id, activeSession?.phase, refreshSession]);

  useEffect(() => {
    if (activeSession?.phase !== 'FIGHTING') {
      return;
    }

    const latestCombat = activeSession.combats?.length ? activeSession.combats[0] : undefined;
    if (latestCombat?.status === 'ACTIVE') {
      navigate(`/combat/${latestCombat.id}`);
    } else {
      // Force a refresh if we are in fighting phase but no active combat is found yet
      const timer = setTimeout(() => {
        void refreshSession({ silent: true });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeSession?.combats, activeSession?.phase, navigate, refreshSession]);

  const p1IsMe = activeSession?.player1Id === currentPlayerId;
  const amIReady = p1IsMe ? activeSession?.player1Ready : activeSession?.player2Ready;
  const isOpponentReady = p1IsMe ? activeSession?.player2Ready : activeSession?.player1Ready;
  const harvestProgress = useMemo(() => Array.from({ length: 4 }, (_, index) => index < pips), [pips]);


  const totalResources = useMemo(
    () => Object.values(inventory).reduce((sum, count) => Number(sum) + Number(count), 0),
    [inventory],
  );

  const inventoryEntries = useMemo(() => Object.entries(inventory), [inventory]);
  const primaryRound = activeSession?.currentRound ?? round;

  const roundStatuses = useMemo(() => {
    const statuses = Array(5).fill('pending');
    if (!activeSession) return statuses;
    
    const sortedCombats = [...(activeSession.combats || [])].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    sortedCombats.forEach((combat, idx) => {
      if (idx < 5 && combat.status === 'FINISHED') {
        if (combat.winnerId === currentPlayerId) statuses[idx] = 'won';
        else statuses[idx] = 'lost';
      }
    });
    
    return statuses;
  }, [activeSession, currentPlayerId]);

  return (
    <div className="resource-map-container">

      <div className="resource-map-layout">
        <aside className="resource-map-sidebar resource-map-sidebar--player">
          <section className="resource-sidebar-card resource-sidebar-card--inventory">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Sacoche</span>
              <h3>Inventaire ({totalResources})</h3>
            </div>
            {inventoryEntries.length === 0 ? (
              <p className="resource-sidebar-card__copy">Aucune ressource récoltée.</p>
            ) : (
              <ul className="resource-inventory-list">
                {inventoryEntries.map(([resource, count]) => (
                  <li key={resource}>
                    <span>{resource}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="resource-sidebar-card">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Progression</span>
              <h3>Récoltes</h3>
            </div>
            <div className="resource-pips" aria-hidden="true">
              {harvestProgress.map((filled, index) => (
                <span key={`pip-${index}`} className={`resource-pip ${filled ? 'is-filled' : ''}`} />
              ))}
            </div>
            <p className="resource-sidebar-card__copy">{pips} / 4 récoltes</p>
          </section>
        </aside>

        <section className="resource-map-stage">
          {activeSession && (
            <div className="round-history-bar">
              {roundStatuses.map((status, index) => (
                <div key={`round-${index}`} className={`round-step ${status} ${primaryRound === index + 1 ? 'current' : ''}`}>
                  {primaryRound === index + 1 && <span className="current-arrow">▼</span>}
                </div>
              ))}
            </div>
          )}

          {hoverInfo && (
            <div className="floating-tile-tooltip">
              <div className="tooltip-header">
                <strong>{TERRAIN_LABELS[hoverInfo.terrain]}</strong>
                <span className="coords">({hoverInfo.x}, {hoverInfo.y})</span>
              </div>
              <div className="tooltip-body">
                {previewPath.length > 0 && <p className="distance">Distance: {previewPath.length} cases</p>}
                {TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable && (
                  <p className="resource">Ressource: <strong>{TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName}</strong></p>
                )}
                {!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable && <p className="warning">Inaccessible</p>}
              </div>
            </div>
          )}

          {actionMessage && <div className={`map-action-toast ${actionMessage.type}`}>{actionMessage.text}</div>}
          {!map && <div className="map-loading">Chargement de la carte...</div>}
          {map && (
            <div className="resource-map-canvas">
              <Canvas>
                <OrthographicCamera makeDefault position={[15, 20, 15]} zoom={30} near={0.1} far={100} />
                <CameraControls
                  ref={setControls}
                  makeDefault
                  minZoom={15}
                  maxZoom={80}
                  dollyToCursor
                  infinityDolly={false}
                  minPolarAngle={0}
                  maxPolarAngle={Math.PI / 2}
                  onStart={() => setIsCameraMoving(true)}
                />
                <ambientLight intensity={0.5} />
                <hemisphereLight args={['#87ceeb', '#654321', 0.6]} />
                <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
                <color attach="background" args={['#0a0e17']} />
                <Suspense fallback={null}>
                  <UnifiedMapScene
                    mode="farming"
                    map={map}
                    playerPosition={playerPosition ?? undefined}
                    movePath={movePath}
                    previewPath={previewPath}
                    onPathComplete={handlePathComplete}
                    onTileClick={handleTileClick}
                    onTileHover={handleTileHover}
                    onTileReached={handleTileReached}
                    isCameraMoving={isCameraMoving}
                    isMoving={isMoving}
                  />
                </Suspense>
              </Canvas>
            </div>
          )}
        </section>

        <aside className="resource-map-sidebar resource-map-sidebar--map">
          <section className="resource-sidebar-card">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Ressources</span>
              <h3>Légende</h3>
            </div>
            <ul className="resource-legend-list">
              {filteredLegend.map((item) => (
                <li key={item.key} className="resource-legend-item">
                  <span className={`resource-legend-swatch ${item.className}`} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>

          {activeSession && activeSession.player2Id && (
            <section className="resource-sidebar-card status-card">
              <p className="resource-sidebar-card__copy">
                {amIReady
                  ? 'Prêt pour le combat.'
                  : isOpponentReady
                    ? 'Adversaire prêt !'
                    : 'En attente des deux joueurs...'}
              </p>
            </section>
          )}
        </aside>
      </div>

      <div className="resource-map-floating-actions">
        {activeSession && (
          <button
            className="resource-action-btn resource-action-btn--danger"
            onClick={handleEndSession}
            title="Quitter la session en cours"
          >
            Abandonner
          </button>
        )}

        {activeSession && activeSession.player2Id && (
          <button
            className={`resource-action-btn resource-action-btn--accent ${amIReady && activeSession.phase === 'FARMING' ? 'is-ready' : ''}`}
            onClick={handleToggleReady}
          >
            {activeSession.phase === 'FIGHTING' 
              ? '⚔️ Rejoindre le combat' 
              : amIReady ? 'Prêt !' : 'Se déclarer prêt'}
          </button>
        )}
      </div>
    </div>
  );
}

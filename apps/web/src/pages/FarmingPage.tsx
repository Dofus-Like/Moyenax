import { CameraControls, OrthographicCamera } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Canvas } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UnifiedMapScene } from '../game/UnifiedMap/UnifiedMapScene';
import { useAutoHarvest } from '../game/UnifiedMap/hooks/useAutoHarvest';
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
import './ResourceMapPage.retro.css';

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

  const map = useFarmingStore((s) => s.map);
  const playerPosition = useFarmingStore((s) => s.playerPosition);
  const movePlayer = useFarmingStore((s) => s.movePlayer);
  const inventory = useFarmingStore((s) => s.inventory);
  const fetchState = useFarmingStore((s) => s.fetchState);
  const gatherNode = useFarmingStore((s) => s.gatherNode);
  const debugRefill = useFarmingStore((s) => s.debugRefill);
  const round = useFarmingStore((s) => s.round);
  const pips = useFarmingStore((s) => s.pips);
  const spendableGold = useFarmingStore((s) => s.spendableGold);
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
      const previousPips = useFarmingStore.getState().pips;
      const nextState = await gatherNode(x, y);
      await syncSpendableGold();

      if (!nextState || isDebugMode || previousPips <= 0 || nextState.pips !== 0 || isTransitioningToCrafting) {
        return;
      }

      setIsTransitioningToCrafting(true);
      navigate('/crafting');
    },
    [gatherNode, isDebugMode, isTransitioningToCrafting, navigate, syncSpendableGold],
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

  const handleNextRound = useCallback(async () => {
    try {
      if (isDebugMode) {
        await debugRefill();
        showActionMessage('Pips restaures.', 'info');
      }
    } catch (error) {
      console.error(error);
      showActionMessage('Impossible de terminer la manche.', 'error');
    }
  }, [debugRefill, isDebugMode, showActionMessage]);

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

    try {
      const isReady =
        activeSession.player1Id === currentPlayerId ? activeSession.player1Ready : activeSession.player2Ready;
      await gameSessionApi.toggleReady(!isReady, activeSession.id);
      await refreshSession({ silent: true });
    } catch (error) {
      console.error('Erreur toggle ready:', error);
    }
  }, [activeSession, currentPlayerId, refreshSession]);

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
    }
  }, [activeSession?.combats, activeSession?.phase, navigate]);

  const p1IsMe = activeSession?.player1Id === currentPlayerId;
  const amIReady = p1IsMe ? activeSession?.player1Ready : activeSession?.player2Ready;
  const isOpponentReady = p1IsMe ? activeSession?.player2Ready : activeSession?.player1Ready;
  const harvestProgress = useMemo(() => Array.from({ length: 4 }, (_, index) => index < pips), [pips]);

  const currentTerrain = map ? map.grid[currentPlayerPos.y]?.[currentPlayerPos.x] : TerrainType.GROUND;
  useAutoHarvest({
    currentPosition: currentPlayerPos,
    terrain: currentTerrain,
    onHarvest: async (x, y) => {
      await performGather(x, y);
    },
  });

  const totalResources = useMemo(
    () => Object.values(inventory).reduce((sum, count) => Number(sum) + Number(count), 0),
    [inventory],
  );

  const inventoryEntries = useMemo(() => Object.entries(inventory), [inventory]);
  const primaryRound = activeSession?.currentRound ?? round;
  const roundScore = activeSession ? `${activeSession.player1Wins} - ${activeSession.player2Wins}` : 'Solo';

  return (
    <div className="resource-map-container">
      <header className="resource-map-header">
        <div className="resource-map-title">
          <span className="resource-map-title-kicker">Mode</span>
          <div>
            <h2>Farming</h2>
            <p>Recolte, gere ton tempo et prepare la prochaine manche.</p>
          </div>
        </div>

        <div className="resource-map-actions">
          {(!activeSession || activeSession.status !== 'ACTIVE') && (
            <button className="resource-action-btn resource-action-btn--ghost" onClick={() => navigate('/')}>
              Lobby
            </button>
          )}
          <button className="resource-action-btn resource-action-btn--ghost" onClick={() => navigate('/inventory')}>
            Inventaire
          </button>
          <button className="resource-action-btn resource-action-btn--ghost" onClick={() => navigate('/shop')}>
            Boutique
          </button>
          {activeSession && activeSession.player2Id && (
            <button
              className={`resource-action-btn resource-action-btn--accent ${amIReady ? 'is-ready' : ''}`}
              onClick={handleToggleReady}
            >
              {amIReady ? 'Pret' : 'Pret ?'}
            </button>
          )}
          {isDebugMode && (
            <button className="resource-action-btn resource-action-btn--primary" onClick={handleNextRound}>
              Debug refill
            </button>
          )}
          {activeSession && (
            <button className="resource-action-btn resource-action-btn--danger" onClick={handleEndSession}>
              Abandonner
            </button>
          )}
        </div>
      </header>

      <div className="resource-map-layout">
        <aside className="resource-map-sidebar resource-map-sidebar--player">
          <section className="resource-sidebar-card resource-sidebar-card--player">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Session</span>
              <h3>Manche {primaryRound}</h3>
            </div>
            <div className="resource-round-score">
              <strong>{roundScore}</strong>
              <span>{activeSession ? 'Score du duel' : 'Exploration libre'}</span>
            </div>
            {activeSession && activeSession.player2Id && (
              <p className="resource-sidebar-card__copy">
                {amIReady
                  ? 'Tu es pret pour lancer le combat.'
                  : isOpponentReady
                    ? 'Ton adversaire est pret, tu peux valider.'
                    : 'Les deux joueurs doivent se declarer prets.'}
              </p>
            )}
          </section>

          <section className="resource-sidebar-card">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Progression</span>
              <h3>Recoltes</h3>
            </div>
            <div className="resource-pips" aria-hidden="true">
              {harvestProgress.map((filled, index) => (
                <span key={`pip-${index}`} className={`resource-pip ${filled ? 'is-filled' : ''}`} />
              ))}
            </div>
            <p className="resource-sidebar-card__copy">{pips} / 4 recoltes restantes</p>
          </section>

          <section className="resource-sidebar-card">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Economie</span>
              <h3>Solde</h3>
            </div>
            <div className="resource-round-score">
              <strong>{spendableGold}</strong>
              <span>{activeSession ? 'Po disponibles en session' : 'or disponible'}</span>
            </div>
          </section>

          <section className="resource-sidebar-card resource-sidebar-card--inventory">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Sacoche</span>
              <h3>Inventaire ({totalResources})</h3>
            </div>
            {inventoryEntries.length === 0 ? (
              <p className="resource-sidebar-card__copy">Aucune ressource recoltee pour le moment.</p>
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
        </aside>

        <section className="resource-map-stage">
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
          {seedConfig && (
            <section className="resource-sidebar-card resource-sidebar-card--seed">
              <span className="resource-sidebar-card__eyebrow">Biome</span>
              <h3>{seedConfig.label}</h3>
              <p>{seedConfig.dominantBuild}</p>
            </section>
          )}

          <section className="resource-sidebar-card">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Ressources</span>
              <h3>Legende</h3>
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

          <section className="resource-sidebar-card">
            <div className="resource-sidebar-card__header">
              <span className="resource-sidebar-card__eyebrow">Case</span>
              <h3>{hoverInfo ? TERRAIN_LABELS[hoverInfo.terrain] : 'Survole une case'}</h3>
            </div>
            {hoverInfo ? (
              <div className="resource-tile-details">
                <p>
                  Coordonnees: ({hoverInfo.x}, {hoverInfo.y})
                </p>
                {previewPath.length > 0 && <p>Distance: {previewPath.length} cases</p>}
                {TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable && (
                  <p>Ressource: {TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName}</p>
                )}
                {!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable && <p>Case inaccessible</p>}
              </div>
            ) : (
              <p className="resource-sidebar-card__copy">La legende et le detail de tuile restent accessibles ici.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

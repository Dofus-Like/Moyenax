import { CameraControls, OrthographicCamera, useProgress } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Canvas } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FarmingMapScene } from './FarmingMapScene';
import { CanvasPerfOverlay } from '../perf/CanvasPerfOverlay';
import { gameSessionApi } from '../api/game-session.api';
import { useAuthStore } from '../store/auth.store';
import { useFarmingStore } from '../store/farming.store';
import { useGameSession } from './GameTunnel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../api/inventory.api';
import { equipmentApi } from '../api/equipment.api';
import { shopApi } from '../api/shop.api';
import { craftingApi } from '../api/crafting.api';
import {
  type PathNode,
  type PlayerStats,
  findPath,
  findPathToAdjacent,
  SEED_CONFIGS,
  TERRAIN_PROPERTIES,
  TerrainType,
  type SeedId,
} from '@game/shared-types';
import { getItemVisualMeta } from '../utils/itemVisual';
import { getResourceIconPath } from '../utils/resourceIcons';
import { FarmingSidebar } from '../components/Farming/FarmingSidebar';
import { SpellBar, SpellBarItem } from '../components/SpellBar/SpellBar';
import { playerApi } from '../api/player.api';
import { CombatBackgroundShader } from '../game/Combat/CombatBackgroundShader';
import { CameraEffects } from '../game/Combat/CameraEffects';
import { countRemainingResources } from '../utils/farming';
import { getTimeOfDay } from '../utils/timeOfDay';
import { EndTurnButton } from '../game/HUD/EndTurnButton';
import { useTranslation } from '../store/language.store';
import './ResourceMapPage.css';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (_id: string): void => {};

function findSpawnPosition(grid: TerrainType[][]): PathNode {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };

  if (width === 0 || height === 0) {
    return { x: 0, y: 0 };
  }

  const maxRadius = Math.max(width, height);
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (Math.abs(x - center.x) + Math.abs(y - center.y) > radius) continue;
        if (TERRAIN_PROPERTIES[grid[y][x]].traversable) {
          return { x, y };
        }
      }
    }
  }
  return { x: 0, y: 0 };
}



type FarmingStatKey = keyof Pick<PlayerStats, 'vit' | 'atk' | 'mag' | 'def' | 'res' | 'ini' | 'pa' | 'pm'>;
type FarmingBaseStatKey = `base${Capitalize<FarmingStatKey>}`;

const FARMING_STAT_ROWS: Array<{ key: FarmingStatKey; baseKey: FarmingBaseStatKey; label: string }> = [
  { key: 'vit', baseKey: 'baseVit', label: 'PV' },
  { key: 'atk', baseKey: 'baseAtk', label: 'ATK' },
  { key: 'mag', baseKey: 'baseMag', label: 'MAG' },
  { key: 'def', baseKey: 'baseDef', label: 'DEF' },
  { key: 'res', baseKey: 'baseRes', label: 'RES' },
  { key: 'ini', baseKey: 'baseIni', label: 'INI' },
  { key: 'pa', baseKey: 'basePa', label: 'PA' },
  { key: 'pm', baseKey: 'basePm', label: 'PM' },
];

export function FarmingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language, languages, setLanguage, t } = useTranslation();
  const [searchParams] = useSearchParams();
  const player = useAuthStore((s) => s.player);
  const refreshPlayer = useAuthStore((s) => s.refreshPlayer);
  const { activeSession, refreshSession } = useGameSession();
  const currentPlayerId = player?.id;
  const isDebugMode = searchParams.get('debug') === 'true';

  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; terrain: TerrainType } | null>(null);
  const [movePath, setMovePath] = useState<PathNode[] | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isMapSceneReady, setIsMapSceneReady] = useState(false);
  const [, setIsTransitioning] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);
  const isActionInProgressRef = useRef(false);
  const [queuedAction, setQueuedAction] = useState<{ type: 'gather'; x: number; y: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const didSpawnOnPageLoadRef = useRef(false);
  const isMovingRef = useRef(false);

  const handleSceneReady = useCallback(() => setIsMapSceneReady(true), []);

  const map = useFarmingStore((s) => s.map);
  const playerPosition = useFarmingStore((s) => s.playerPosition);
  const movePlayer = useFarmingStore((s) => s.movePlayer);
  const gatherNode = useFarmingStore((s) => s.gatherNode);
  const round = useFarmingStore((s) => s.round);
  const pips = useFarmingStore((s) => s.pips);
  const inventoryCounts = useFarmingStore((s) => s.inventory);
  const seedId = useFarmingStore((s) => s.seedId);
  const spendableGold = useFarmingStore((s) => s.spendableGold);
  const harvestedTiles = useFarmingStore((s) => s.harvestedTiles);
  const fetchState = useFarmingStore((s) => s.fetchState);

  const mapRef = useRef(map);
  const playerPosRef = useRef(playerPosition);
  const harvestedTilesRef = useRef(harvestedTiles);
  mapRef.current = map;
  playerPosRef.current = playerPosition;
  harvestedTilesRef.current = harvestedTiles;
  isMovingRef.current = isMoving;

  const [controls, setControls] = useState<CameraControlsImpl | null>(null);
  const [isGathering, setIsGathering] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  const pipArray = useMemo(() => Array.from({ length: 4 }, (_, i) => i < pips), [pips]);

  const remainingResources = useMemo(() => {
    if (!seedId || !map) return [];
    return countRemainingResources(map.grid, seedId as SeedId);
  }, [seedId, map]);

  const { active: isAssetLoading, progress: assetLoadProgress } = useProgress();
  const isFarmingLoaded = Boolean(map && isMapSceneReady && !isAssetLoading);

  // -- Data Fetching --
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getInventory(),
  });

  const { data: spellData } = useQuery({
    queryKey: ['player-spells'],
    queryFn: () => playerApi.getSpells(),
  });

  const { data: equipmentData } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.getEquipment(),
  });

  const { data: shopItemsData } = useQuery({
    queryKey: ['shop-items'],
    queryFn: () => shopApi.getItems(),
  });
  
  const { data: statsData } = useQuery({
    queryKey: ['player-stats'],
    queryFn: () => playerApi.getStats(),
  });

  const equipMutation = useMutation({
    mutationFn: ({ slot, id }: { slot: any; id: string }) => equipmentApi.equip(slot, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['player-spells'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
    },
  });

  const useItemMutation = useMutation({
    mutationFn: (itemId: string) => inventoryApi.useItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
    },
  });

  // -- Mappings --
  const mappedInventory = useMemo(() => {
    return (inventoryData?.data || []).map((inv: any) => {
      const meta = getItemVisualMeta(inv.item);
      return {
        ...inv,
        name: inv.item.name,
        icon: meta.icon,
        iconPath: inv.iconPath || meta.iconPath,
        toneClass: meta.toneClass,
      };
    });
  }, [inventoryData]);

  const mappedForgeItems = useMemo(() => {
    return (shopItemsData?.data || [])
      .filter((item: any) => item.craftCost != null)
      .map((item: any) => ({
        ...item,
        ...getItemVisualMeta(item),
      }));
  }, [shopItemsData]);

  const mappedShopItems = useMemo(() => {
    return (shopItemsData?.data || [])
      .filter((item: any) => item.shopPrice != null)
      .map((item: any) => ({
        ...item,
        ...getItemVisualMeta(item),
      }));
  }, [shopItemsData]);

  const handleBuy = useCallback(async (item: any) => {
    try {
      await shopApi.buyItem({ itemId: item.id, quantity: 1 });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        fetchState(),
        refreshPlayer(),
        refreshSession({ silent: true }),
      ]);
      setActionMessage({ text: t('bought', { name: item.name }), type: 'info' });
    } catch (e) {
      setActionMessage({ text: t('notEnoughCoins'), type: 'error' });
    }
  }, [fetchState, queryClient, refreshPlayer, refreshSession, t]);

  const mappedSpells = useMemo((): SpellBarItem[] => {
    return (Array.isArray(spellData) ? spellData : []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      iconPath: s.iconPath,
      paCost: s.paCost,
      family: s.family,
      sortOrder: s.sortOrder,
      damage: s.damage,
      effectKind: s.effectKind,
      minRange: s.minRange,
      maxRange: s.maxRange,
    }));
  }, [spellData]);

  const mappedEquipment = useMemo(() => {
    const eq = equipmentData?.data || {};
    const result: any = {};
    Object.entries(eq).forEach(([slot, invItem]: [string, any]) => {
      if (invItem && invItem.item) {
        result[slot] = {
          ...invItem.item,
          id: invItem.id, // The inventory item ID
          ...getItemVisualMeta(invItem.item),
        };
      }
    });
    
    return {
       head: result.ARMOR_HEAD,
       amulet: result.ACCESSORY,
       weaponLeft: result.WEAPON_LEFT,
       weaponRight: result.WEAPON_RIGHT,
       chest: result.ARMOR_CHEST,
       feet: result.ARMOR_LEGS,
       ring1: result.RING1,
       ring2: result.RING2
    };
  }, [equipmentData]);

  // -- Handlers --
  const handleEquip = useCallback(async (inv: any) => {
    if (!inv || !inv.item) return;
    
    // Check if already equipped in ANY slot
    const equippedSlot = Object.entries(equipmentData?.data || {}).find(
      ([, eqItem]) => (eqItem as any)?.id === inv.id
    )?.[0];

    if (equippedSlot) {
      await equipmentApi.unequip(equippedSlot as any);
    } else {
      let slot: any = null;
      const type = inv.item.type;
      
      if (type === 'WEAPON') {
        const hasRight = !!equipmentData?.data?.WEAPON_RIGHT;
        const hasLeft = !!equipmentData?.data?.WEAPON_LEFT;
        
        if (!hasRight) slot = 'WEAPON_RIGHT';
        else if (!hasLeft) slot = 'WEAPON_LEFT';
        else {
          setActionMessage({ text: "Vous avez déjà 2 armes équipées", type: 'error' });
          return;
        }
      } 
      else if (type === 'ARMOR_HEAD') slot = 'ARMOR_HEAD';
      else if (type === 'ARMOR_CHEST') slot = 'ARMOR_CHEST';
      else if (type === 'ARMOR_LEGS') slot = 'ARMOR_LEGS';
      else if (type === 'ACCESSORY') slot = 'ACCESSORY';
      
      if (slot) await equipmentApi.equip(slot, inv.id);
    }
    
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    queryClient.invalidateQueries({ queryKey: ['player-spells'] });
    refreshPlayer();
  }, [equipmentData, queryClient, refreshPlayer]);

  const handleUnequip = useCallback(async (slot: any) => {
    if (!slot) return;
    try {
      await equipmentApi.unequip(slot);
      setActionMessage({ text: 'Équipement retiré', type: 'info' as const });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['inventory'] }),
        queryClient.refetchQueries({ queryKey: ['equipment'] }),
        queryClient.refetchQueries({ queryKey: ['player-spells'] }),
        queryClient.refetchQueries({ queryKey: ['player-stats'] }),
        fetchState(),
        refreshPlayer(),
      ]);
    } catch (e: any) {
      setActionMessage({ text: "Erreur lors du retrait", type: 'error' as const });
    }
  }, [queryClient, fetchState, refreshPlayer]);

  const handleUse = useCallback(async (item: any) => {
    try {
      await useItemMutation.mutateAsync(item.itemId || item.id);
      setActionMessage({ text: t('itemUsed', { name: item.name }), type: 'info' });
    } catch {
      setActionMessage({ text: t('useError'), type: 'error' });
    }
  }, [useItemMutation, t]);

  const handleCraft = useCallback(async (item: any) => {
    try {
      await craftingApi.craftItem(item.id);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await fetchState();
      refreshPlayer();
      setActionMessage({ text: t('crafted', { name: item.name }), type: 'info' });
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || t('notEnoughResources');
      setActionMessage({ text: errorMsg, type: 'error' });
    }
  }, [fetchState, queryClient, refreshPlayer, t]);

  const handleToggleReady = useCallback(async () => {
    if (!activeSession) return;
    if (isActionInProgressRef.current) return;
    try {
      isActionInProgressRef.current = true;
      setIsTransitioning(true);
      const isReady = activeSession.player1Id === currentPlayerId ? activeSession.player1Ready : activeSession.player2Ready;
      const { data: updated } = await gameSessionApi.toggleReady(!isReady, activeSession.id);
      if (updated.phase === 'FIGHTING' && updated.combats?.[0]) {
        const latestCombat = updated.combats[0];
        navigate(`/combat/${latestCombat.id}`);
        return;
      }
      await refreshSession({ silent: true });
    } finally {
      setIsTransitioning(false);
      isActionInProgressRef.current = false;
    }
  }, [activeSession, currentPlayerId, refreshSession, navigate]);

  const handleEndSession = useCallback(async () => {
    if (!activeSession) return;
    if (!window.confirm(t('abandonGameConfirm'))) return;
    try {
      await gameSessionApi.endSession(activeSession.id);
      navigate('/');
    } catch (e) {
      console.error(e);
      navigate('/');
    }
  }, [activeSession, navigate, t]);

  const performGather = useCallback(async (x: number, y: number) => {
    if (isGathering) return;
    setIsGathering(true);
    try {
      await gatherNode(x, y);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } finally {
      setIsGathering(false);
    }
  }, [gatherNode, queryClient, isGathering]);

  const handleTileClick = useCallback((x: number, y: number, terrain: TerrainType) => {
    const currentMap = mapRef.current;
    const currentPos = playerPosRef.current;
    if (!currentMap || isMovingRef.current || !currentPos) return;
    if (harvestedTilesRef.current.has(`${x},${y}`)) return;
    const isAdjacent = Math.abs(currentPos.x - x) + Math.abs(currentPos.y - y) <= 1;
    if (TERRAIN_PROPERTIES[terrain].harvestable) {
      if (isAdjacent) { performGather(x, y); return; }
      const path = findPathToAdjacent(currentMap, currentPos, { x, y });
      // Un chemin vide (déjà à portée) ne déclenche jamais onPathComplete : on récolte
      // directement, sinon isMoving resterait bloqué à true (joueur figé).
      if (path && path.length > 0) { setMovePath(path); setQueuedAction({ type: 'gather', x, y }); setIsMoving(true); }
      else if (path) { performGather(x, y); }
    } else if (TERRAIN_PROPERTIES[terrain].traversable) {
      const path = findPath(currentMap, currentPos, { x, y });
      if (path && path.length > 0) { setMovePath(path); setIsMoving(true); }
    }
  }, [performGather]);

  useEffect(() => {
    // Force spell sync on mount
    playerApi.getSpells().then(() => {
      queryClient.invalidateQueries({ queryKey: ['player-spells'] });
    });
  }, [queryClient]);

  const handlePathComplete = useCallback(() => {
    if (movePath && movePath.length > 0) {
      const last = movePath[movePath.length - 1];
      movePlayer(last);
      if (queuedAction?.type === 'gather') performGather(queuedAction.x, queuedAction.y);
    }
    setMovePath(null); setQueuedAction(null); setIsMoving(false);
  }, [movePath, movePlayer, performGather, queuedAction]);

  // -- Lifecycle --
  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  // Pas besoin de reload la 3D scene quand la grille change (gather) — meme dimensions

  useEffect(() => {
    if (map && !didSpawnOnPageLoadRef.current) {
      didSpawnOnPageLoadRef.current = true;
      const spawn = findSpawnPosition(map.grid);
      movePlayer(spawn);
      setHoverInfo({ x: spawn.x, y: spawn.y, terrain: map.grid[spawn.y][spawn.x] as TerrainType });
    }
  }, [map, movePlayer]);

  useEffect(() => {
    if (!actionMessage) return;
    const timeout = window.setTimeout(() => setActionMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [actionMessage]);

  const handleTileHover = useCallback((info: { x: number; y: number; terrain: TerrainType } | null) => {
    setHoverInfo(info);
  }, []);

  const previewPath = useMemo(() => {
    if (!map || !hoverInfo || isMoving || !playerPosition) return [];
    if (TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable) {
      return findPathToAdjacent(map, playerPosition, hoverInfo) || [];
    }
    if (TERRAIN_PROPERTIES[hoverInfo.terrain].traversable) {
      return findPath(map, playerPosition, hoverInfo) || [];
    }
    return [];
  }, [map, hoverInfo, isMoving, playerPosition]);

  const p1IsMe = activeSession?.player1Id === currentPlayerId;
  const amIReady = p1IsMe ? activeSession?.player1Ready : activeSession?.player2Ready;
  const loadingProgress = Math.max(0, Math.min(100, Math.round(assetLoadProgress || 0)));
  const timeOfDay = getTimeOfDay(activeSession?.currentRound || round || 1);

  return (
    <div className="farming-page-layout">
      {!isFarmingLoaded && (
        <div className="loading-screen farming-loading-screen" role="status" aria-live="polite">
          <span>⚔️ {t('loading')}</span>
          {isAssetLoading && <small>{loadingProgress}%</small>}
        </div>
      )}

      {/* ⚙️ Settings Overlay */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-menu" onClick={e => e.stopPropagation()}>
            <h3>{t('settings')}</h3>
            <div className="language-picker" aria-label={t('language')}>
              <span className="language-picker-label">{t('language')}</span>
              <div className="language-flags">
                {languages.map((candidate) => (
                  <button
                    key={candidate.code}
                    type="button"
                    className={`language-flag ${language === candidate.code ? 'active' : ''}`}
                    onClick={() => setLanguage(candidate.code)}
                    title={candidate.label}
                    aria-label={candidate.label}
                  >
                    {candidate.flag}
                  </button>
                ))}
              </div>
            </div>
            <button className="menu-btn" onClick={() => navigate('/')}>{t('backToLobby')}</button>
            <button className="menu-btn danger" onClick={handleEndSession}>{t('abandon')}</button>
            <button className="menu-btn close" onClick={() => setShowSettings(false)}>{t('close')}</button>
          </div>
        </div>
      )}

      <div className="top-left-utility">
        <div className="round-badge">{t('round', { round: activeSession?.currentRound || round })}</div>
        <div className="top-info-panel">
          <div className="pips-row">
            {pipArray.map((filled, i) => (
              <div key={i} className={`pip-diamond ${filled ? 'filled' : ''}`} />
            ))}
          </div>
          <div className="res-column">
            {remainingResources.map((r) => (
              <div key={r.name} className="res-line">
                <img src={getResourceIconPath(r.name)} alt={r.name ?? ''} className="res-icon-img" />
                <span className="res-name">{r.name}</span>
                <span className="res-count">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🗺️ Main Viewport */}
      <main className="farming-viewport">
        {map && (
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
              ref={setControls} 
              minZoom={15} 
              maxZoom={80} 
              dollyToCursor={true}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2.1}
              mouseButtons={{
                left: CameraControlsImpl.ACTION.NONE,
                right: CameraControlsImpl.ACTION.TRUCK,
                middle: CameraControlsImpl.ACTION.NONE,
                wheel: CameraControlsImpl.ACTION.DOLLY
              }}
            />
            
            <CameraEffects controlsRef={{ current: controls } as any} />

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
            
            <Suspense fallback={null}>
              <FarmingMapScene
                map={map}
                harvestedTiles={harvestedTiles}
                playerPosition={playerPosition ?? undefined}
                movePath={movePath}
                onPathComplete={handlePathComplete}
                onTileClick={handleTileClick}
                onTileHover={handleTileHover}
                onSceneReady={handleSceneReady}
                playerPa={statsData?.data?.pa}
                playerPm={statsData?.data?.pm}
              />
            </Suspense>
          </Canvas>
        )}
      </main>

      {/* 🎒 Right Sidebar */}
      <FarmingSidebar 
        inventory={mappedInventory} 
        forgeItems={mappedForgeItems}
        shopItems={mappedShopItems}
        allItems={shopItemsData?.data || []}
        equipment={mappedEquipment}
        resources={inventoryCounts}
        spendableGold={spendableGold}
        onEquip={handleEquip}
        onUnequip={handleUnequip}
        onCraft={handleCraft}
        onBuy={handleBuy}
        onUse={handleUse}
        hoverInfo={hoverInfo}
        previewPath={previewPath}
      />

      {/* 👤 Player Panel — Bottom Left (exact copy of CombatPlayerPanel) */}
      <div className="blocky-avatar-panel farming-avatar">
        <div className="bap-content-row">
          <div className="bap-frame-wrapper">
            <div className="bap-frame">
              <div
                className="bap-portrait"
                style={{ '--avatar-img': 'url("/avatar_gobelin.png")' } as React.CSSProperties}
              >
                <div className="bap-pseudo">{player?.username}</div>
                <div className="bap-resources">
                  <span className="bap-res-pa">◆{statsData?.data?.pa ?? '?'} PA</span>
                  <span className="bap-res-pm">◆{statsData?.data?.pm ?? '?'} PM</span>
                </div>
              </div>
              <div className="bap-hp-bar">
                <div
                  className="bap-hp-fill"
                  style={{ width: `${statsData?.data ? 100 : 0}%` }}
                />
                <div className="bap-hp-text">
                  {statsData?.data ? `${statsData.data.vit}/${statsData.data.vit}` : '?/?'}
                </div>
              </div>
            </div>

            {statsOpen && statsData?.data && (
              <div className="cpp-stats-container">
                <div className="cpp-stats-grid">
                  {(['atk', 'def', 'mag', 'res', 'ini'] as const).map((key) => {
                    const value = statsData.data[key];
                    const baseKey = `base${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof statsData.data;
                    const modifier = value - (statsData.data[baseKey] as number);
                    return (
                      <div className={`cpp-stat stat-${key}`} key={key}>
                        <span className="cpp-stat-label">{key.toUpperCase()}</span>
                        <strong>{value}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Icon Buttons (copied from CombatHUD) */}
      <div className="farming-icon-buttons">
        <button
          type="button"
          className="farming-icon-btn"
          aria-label="Paramètres"
          title="Paramètres"
          onClick={() => setShowSettings(true)}
        >
          <img src="/assets/icons/parametres.png" alt="Paramètres" style={{ width: '18px', height: '18px' }} />
        </button>
        <button
          type="button"
          className="farming-icon-btn"
          aria-label="Audio"
          title="Audio"
        >
          <img src="/assets/icons/audio.png" alt="Audio" style={{ width: '18px', height: '18px' }} />
        </button>
        <button
          type="button"
          className={`farming-icon-btn${statsOpen ? ' active' : ''}`}
          aria-label="Statistiques"
          title="Statistiques"
          onClick={() => setStatsOpen((v) => !v)}
        >
          <img src="/assets/pack/icons/graph.png" alt="Statistiques" style={{ width: '18px', height: '18px' }} />
        </button>
        <button
          type="button"
          className="farming-icon-btn"
          aria-label="Abandonner"
          title="Abandonner"
          onClick={handleEndSession}
        >
          <img src="/assets/pack/icons/flag.png" alt="Abandonner" style={{ width: '18px', height: '18px' }} />
        </button>
      </div>

      {/* ⚔️ Action Bar */}
      <div className="bottom-center-actions">
        <SpellBar 
          spells={mappedSpells} 
          onSpellClick={noop} 
          onToggleMannequins={() => setShowSettings(true)}
          attackerStats={statsData?.data}
          disableGrimoire={true}
        >
          <EndTurnButton mode="farming-ready" onEndTurn={handleToggleReady} isReady={amIReady} />
        </SpellBar>
      </div>

      {actionMessage && <div className={`map-action-toast ${actionMessage.type}`}>{actionMessage.text}</div>}
    </div>
  );
}

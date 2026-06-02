import { CameraControls, OrthographicCamera, useProgress } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UnifiedMapScene } from '../game/UnifiedMap/UnifiedMapScene';
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
  type SeedId,
  findPath,
  findPathToAdjacent,
  TERRAIN_PROPERTIES,
  TerrainType,
} from '@game/shared-types';
import { getItemVisualMeta } from '../utils/itemVisual';
import { getResourceIconPath } from '../utils/resourceIcons';
import { FarmingSidebar } from '../components/Farming/FarmingSidebar';
import { FarmingTopBar } from '../components/Farming/FarmingTopBar';
import { SpellBar, SpellBarItem } from '../components/SpellBar/SpellBar';
import { PortraitPawn } from '../components/PortraitPawn';
import { playerApi } from '../api/player.api';
import { CombatBackgroundShader } from '../game/Combat/CombatBackgroundShader';
import { CameraEffects } from '../game/Combat/CameraEffects';
import { useTranslation } from '../store/language.store';
import './ResourceMapPage.css';

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

function CameraSync({ zoom, x, y }: { zoom: number; x: number; y: number }) {
  const { camera } = useThree();
  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = zoom;
      camera.position.set(x, y, 10);
      camera.updateProjectionMatrix();
    }
  }, [camera, zoom, x, y]);
  return null;
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

function formatStatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

const TILE_TOOLTIP_OFFSET = 14;
const TILE_TOOLTIP_VIEWPORT_MARGIN = 8;
const TILE_TOOLTIP_DEFAULT_SIZE = { width: 252, height: 150 };
const TILE_TOOLTIP_UI_SELECTOR = [
  '.top-left-utility',
  '.top-center-container',
  '.farming-sidebar',
  '.bottom-left-card',
  '.bottom-center-actions',
  '.settings-overlay',
  '.map-action-toast',
].join(',');

type TileTooltipPoint = { x: number; y: number };

function isPointerOverFarmingUi(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(TILE_TOOLTIP_UI_SELECTOR));
}

function getOverlapArea(a: DOMRect, b: DOMRect) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function getViewportOverflowArea(rect: DOMRect, viewportWidth: number, viewportHeight: number) {
  const overflowX = Math.max(0, -rect.left) + Math.max(0, rect.right - viewportWidth);
  const overflowY = Math.max(0, -rect.top) + Math.max(0, rect.bottom - viewportHeight);
  return overflowX * rect.height + overflowY * rect.width;
}

function getTileTooltipPlacement(
  pointer: TileTooltipPoint,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  blockers: DOMRect[],
) {
  const rawCandidates = [
    { left: pointer.x + TILE_TOOLTIP_OFFSET, top: pointer.y + TILE_TOOLTIP_OFFSET },
    { left: pointer.x - tooltipWidth - TILE_TOOLTIP_OFFSET, top: pointer.y + TILE_TOOLTIP_OFFSET },
    { left: pointer.x + TILE_TOOLTIP_OFFSET, top: pointer.y - tooltipHeight - TILE_TOOLTIP_OFFSET },
    { left: pointer.x - tooltipWidth - TILE_TOOLTIP_OFFSET, top: pointer.y - tooltipHeight - TILE_TOOLTIP_OFFSET },
  ];

  const candidates = rawCandidates.map((candidate, priority) => {
    const left = Math.min(
      Math.max(TILE_TOOLTIP_VIEWPORT_MARGIN, candidate.left),
      viewportWidth - tooltipWidth - TILE_TOOLTIP_VIEWPORT_MARGIN,
    );
    const top = Math.min(
      Math.max(TILE_TOOLTIP_VIEWPORT_MARGIN, candidate.top),
      viewportHeight - tooltipHeight - TILE_TOOLTIP_VIEWPORT_MARGIN,
    );
    const rect = new DOMRect(left, top, tooltipWidth, tooltipHeight);
    const uiOverlap = blockers.reduce((total, blocker) => total + getOverlapArea(rect, blocker), 0);
    const overflow = getViewportOverflowArea(rect, viewportWidth, viewportHeight);

    return { left, top, score: uiOverlap + overflow * 100 + priority * 0.01 };
  });

  return candidates.reduce((bestCandidate, candidate) =>
    candidate.score < bestCandidate.score ? candidate : bestCandidate,
  );
}

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
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const [isMapSceneReady, setIsMapSceneReady] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAttackingPortrait, setIsAttackingPortrait] = useState(false);
  const [portraitZoom, setPortraitZoom] = useState(103);
  const [portraitX, setPortraitX] = useState(0.02);
  const [portraitY, setPortraitY] = useState(0.05);
  const isActionInProgressRef = useRef(false);
  const tileTooltipRef = useRef<HTMLDivElement | null>(null);
  const tileTooltipRafRef = useRef<number | null>(null);
  const tileTooltipPointerRef = useRef<TileTooltipPoint | null>(null);
  const isPointerPressedRef = useRef(false);
  const [queuedAction, setQueuedAction] = useState<{ type: 'gather'; x: number; y: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const didSpawnOnPageLoadRef = useRef(false);

  const map = useFarmingStore((s) => s.map);
  const playerPosition = useFarmingStore((s) => s.playerPosition);
  const movePlayer = useFarmingStore((s) => s.movePlayer);
  const gatherNode = useFarmingStore((s) => s.gatherNode);
  const round = useFarmingStore((s) => s.round);
  const pips = useFarmingStore((s) => s.pips);
  const inventoryCounts = useFarmingStore((s) => s.inventory);
  const spendableGold = useFarmingStore((s) => s.spendableGold);
  const fetchState = useFarmingStore((s) => s.fetchState);

  const [controls, setControls] = useState<CameraControlsImpl | null>(null);
  const [isGathering, setIsGathering] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
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

  // -- Mappings --
  const mappedInventory = useMemo(() => {
    return (inventoryData?.data || []).map((inv: any) => ({
      ...inv,
      name: inv.item.name,
      ...getItemVisualMeta(inv.item),
    }));
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
    await equipmentApi.unequip(slot);
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    queryClient.invalidateQueries({ queryKey: ['player-spells'] });
    refreshPlayer();
  }, [queryClient, refreshPlayer]);

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
    if (!map || isMoving) return;
    const isAdjacent = Math.abs(playerPosition!.x - x) + Math.abs(playerPosition!.y - y) <= 1;
    if (TERRAIN_PROPERTIES[terrain].harvestable) {
      if (isAdjacent) { performGather(x, y); return; }
      const path = findPathToAdjacent(map, playerPosition!, { x, y });
      if (path) { setMovePath(path); setQueuedAction({ type: 'gather', x, y }); setIsMoving(true); }
    } else if (TERRAIN_PROPERTIES[terrain].traversable) {
      const path = findPath(map, playerPosition!, { x, y });
      if (path) { setMovePath(path); setIsMoving(true); }
    }
  }, [map, playerPosition, isMoving, performGather]);

  useEffect(() => {
    // Force spell sync on mount
    playerApi.getSpells().then(data => {
      console.log('Initial Spells Sync:', data);
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

  useEffect(() => {
    setIsMapSceneReady(false);
  }, [map]);

  useEffect(() => {
    if (map && !didSpawnOnPageLoadRef.current) {
      didSpawnOnPageLoadRef.current = true;
      movePlayer(findSpawnPosition(map.grid));
    }
  }, [map, movePlayer]);

  useEffect(() => {
    if (!actionMessage) return;
    const timeout = window.setTimeout(() => setActionMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [actionMessage]);

  const updateTileTooltipPosition = useCallback((pointer: TileTooltipPoint) => {
    const tooltip = tileTooltipRef.current;
    if (!tooltip) return;

    if (isPointerPressedRef.current) {
      tooltip.style.visibility = 'hidden';
      return;
    }

    const target = document.elementFromPoint(pointer.x, pointer.y);
    if (isPointerOverFarmingUi(target)) {
      tooltip.style.visibility = 'hidden';
      return;
    }

    const tooltipWidth = tooltip.offsetWidth || TILE_TOOLTIP_DEFAULT_SIZE.width;
    const tooltipHeight = tooltip.offsetHeight || TILE_TOOLTIP_DEFAULT_SIZE.height;
    const blockers = Array.from(document.querySelectorAll(TILE_TOOLTIP_UI_SELECTOR)).map((element) =>
      element.getBoundingClientRect(),
    );
    const placement = getTileTooltipPlacement(
      pointer,
      tooltipWidth,
      tooltipHeight,
      window.innerWidth,
      window.innerHeight,
      blockers,
    );

    tooltip.style.visibility = 'visible';
    tooltip.style.transform = `translate3d(${placement.left}px, ${placement.top}px, 0)`;
  }, []);

  useEffect(() => {
    if (!hoverInfo) return;

    const queueTooltipPosition = (pointer: TileTooltipPoint) => {
      tileTooltipPointerRef.current = pointer;
      if (tileTooltipRafRef.current !== null) return;

      tileTooltipRafRef.current = window.requestAnimationFrame(() => {
        tileTooltipRafRef.current = null;
        const latestPointer = tileTooltipPointerRef.current;
        if (latestPointer) {
          updateTileTooltipPosition(latestPointer);
        }
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      queueTooltipPosition({ x: event.clientX, y: event.clientY });
    };

    const handlePointerDown = () => {
      isPointerPressedRef.current = true;
      if (tileTooltipRef.current) {
        tileTooltipRef.current.style.visibility = 'hidden';
      }
    };

    const handlePointerUp = () => {
      isPointerPressedRef.current = false;
      if (tileTooltipPointerRef.current) {
        queueTooltipPosition(tileTooltipPointerRef.current);
      }
    };

    const handlePointerCancel = () => {
      isPointerPressedRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerCancel, { passive: true });

    if (tileTooltipPointerRef.current) {
      queueTooltipPosition(tileTooltipPointerRef.current);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      if (tileTooltipRafRef.current !== null) {
        window.cancelAnimationFrame(tileTooltipRafRef.current);
        tileTooltipRafRef.current = null;
      }
    };
  }, [hoverInfo, updateTileTooltipPosition]);

  const handleTileHover = useCallback((info: { x: number; y: number; terrain: TerrainType } | null) => {
    setHoverInfo((previous) => {
      if (!info || !previous) return info;
      if (previous.x === info.x && previous.y === info.y && previous.terrain === info.terrain) {
        return previous;
      }
      return info;
    });
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

      {/* 🏷️ Top Utility Bar */}
      <div className="top-left-utility">
        <button className="gear-btn" onClick={() => setShowSettings(true)}>⚙️</button>
        <div className="round-badge">{t('round', { round: activeSession?.currentRound || round })}</div>
      </div>

      {/* 📊 Tooltip Overlay */}
      {hoverInfo && (
        <div ref={tileTooltipRef} className="floating-tile-tooltip">
          <div className="tooltip-header">
            <strong>{hoverInfo.terrain}</strong>
            <span className="coords">({hoverInfo.x}, {hoverInfo.y})</span>
          </div>
          <div className="tooltip-body">
            {previewPath.length > 0 && <p className="distance">{t('tileDistance', { count: previewPath.length })}</p>}
            {TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable && (
              <p className="resource">
                {t('tileResource')}
                <img 
                  src={getResourceIconPath(TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName)} 
                  alt="" 
                  className="inline-res-icon" 
                />
                <strong>{TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName}</strong>
              </p>
            )}
            {!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable && <p className="warning">{t('inaccessible')}</p>}
          </div>
        </div>
      )}

      <div className="top-center-container">
        <FarmingTopBar pips={pips} resources={inventoryCounts} />
      </div>

      {/* 🗺️ Main Viewport */}
      <main className="farming-viewport">
        {map && (
          <Canvas
            shadows
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 2]}
            camera={{ fov: 30 }}
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
              ref={setControls} 
              minZoom={15} 
              maxZoom={80} 
              dollyToCursor 
              onRest={() => setIsCameraMoving(false)}
              onStart={() => setIsCameraMoving(true)}
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
              <UnifiedMapScene
                mode="farming"
                map={map}
                playerPosition={playerPosition ?? undefined}
                movePath={movePath}
                previewPath={previewPath}
                onPathComplete={handlePathComplete}
                onTileClick={handleTileClick}
                onTileHover={handleTileHover}
                isCameraMoving={isCameraMoving}
                isMoving={isMoving}
                onSceneReady={() => setIsMapSceneReady(true)}
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
      />

      {/* 👤 Player Card & Ready Button */}
      <div className="bottom-left-card">
        <div className="player-portrait-card">
          <div className="portrait-circle">
            <Canvas 
              orthographic 
              dpr={1}
              gl={{ 
                alpha: true, 
                antialias: false, 
                premultipliedAlpha: false,
                toneMapping: THREE.NoToneMapping
              }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
              }}
            >
              <CameraSync zoom={portraitZoom} x={portraitX} y={portraitY} />
              <Suspense fallback={null}>
                <PortraitPawn 
                  skinId={player?.skin} 
                  isAttacking={isAttackingPortrait}
                  onAttackComplete={() => setIsAttackingPortrait(false)}
                />
              </Suspense>
            </Canvas>
          </div>
          <div className="portrait-info">
            <span className="player-name">{player?.username}</span>
            <div className="mini-stats">
              {statsData?.data ? (
                FARMING_STAT_ROWS.map(({ key, baseKey, label }) => {
                  const value = statsData.data[key];
                  const modifier = value - statsData.data[baseKey];

                  return (
                    <span className="mini-stat" key={key}>
                      <span className="mini-stat-label">{label}</span>
                      <strong>{value}</strong>
                      <span className={`mini-stat-mod ${modifier > 0 ? 'is-positive' : modifier < 0 ? 'is-negative' : ''}`}>
                        ({formatStatModifier(modifier)})
                      </span>
                    </span>
                  );
                })
              ) : (
                <span className="mini-stat-loading">Stats...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ⚔️ Action Bar */}
      <div className="bottom-center-actions">
        <SpellBar 
          spells={mappedSpells} 
          onSpellClick={(id) => {
            console.log('Spell', id);
            setIsAttackingPortrait(true);
          }} 
          onToggleMannequins={() => setShowSettings(true)}
          onPassTurn={handleToggleReady}
          passLabel={t('ready')}
          isReadyMode={true}
          canPassTurn={!isTransitioning}
          isReady={amIReady}
          attackerStats={statsData?.data}
          disableGrimoire={true}
        />
      </div>

      {actionMessage && <div className={`map-action-toast ${actionMessage.type}`}>{actionMessage.text}</div>}
    </div>
  );
}

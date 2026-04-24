import { CameraControls, OrthographicCamera } from '@react-three/drei';
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
import './ResourceMapPage.css';

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

export function FarmingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [isReadyToRender, setIsReadyToRender] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAttackingPortrait, setIsAttackingPortrait] = useState(false);
  const [portraitZoom, setPortraitZoom] = useState(103);
  const [portraitX, setPortraitX] = useState(0.02);
  const [portraitY, setPortraitY] = useState(0.05);
  const isActionInProgressRef = useRef(false);
  const [queuedAction, setQueuedAction] = useState<{ type: 'gather'; x: number; y: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const map = useFarmingStore((s) => s.map);
  const playerPosition = useFarmingStore((s) => s.playerPosition);
  const movePlayer = useFarmingStore((s) => s.movePlayer);
  const gatherNode = useFarmingStore((s) => s.gatherNode);
  const round = useFarmingStore((s) => s.round);
  const pips = useFarmingStore((s) => s.pips);
  const inventoryCounts = useFarmingStore((s) => s.inventory);
  const fetchState = useFarmingStore((s) => s.fetchState);

  const [controls, setControls] = useState<CameraControlsImpl | null>(null);
  const [isGathering, setIsGathering] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

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

  const equipMutation = useMutation({
    mutationFn: ({ slot, id }: { slot: any; id: string }) => equipmentApi.equip(slot, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['player-spells'] });
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
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      refreshPlayer();
      setActionMessage({ text: `${item.name} acheté !`, type: 'info' });
    } catch (e) {
      setActionMessage({ text: "Pièces insuffisantes", type: 'error' });
    }
  }, [queryClient, refreshPlayer]);

  const mappedSpells = useMemo((): SpellBarItem[] => {
    return (Array.isArray(spellData) ? spellData : []).map((s: any) => ({
      id: s.id,
      name: s.name,
      iconPath: s.iconPath,
      paCost: s.paCost,
      family: s.family,
      sortOrder: s.sortOrder,
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
      refreshPlayer();
      setActionMessage({ text: `${item.name} forgé !`, type: 'info' });
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || "Ressources insuffisantes";
      setActionMessage({ text: errorMsg, type: 'error' });
    }
  }, [queryClient, refreshPlayer]);

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
    if (!window.confirm('Abandonner la partie ?')) return;
    try {
      await gameSessionApi.endSession(activeSession.id);
      navigate('/');
    } catch (e) {
      console.error(e);
      navigate('/');
    }
  }, [activeSession, navigate]);

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
    const timer = setTimeout(() => setIsReadyToRender(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (map && !playerPosition) {
      movePlayer(findSpawnPosition(map.grid));
    }
  }, [map, playerPosition, movePlayer]);

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

  return (
    <div className="farming-page-layout">
      {/* ⚙️ Settings Overlay */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-menu" onClick={e => e.stopPropagation()}>
            <h3>Options</h3>
            <button className="menu-btn" onClick={() => navigate('/')}>Retour au Lobby</button>
            <button className="menu-btn danger" onClick={handleEndSession}>Abandonner</button>
            <button className="menu-btn close" onClick={() => setShowSettings(false)}>Fermer</button>
          </div>
        </div>
      )}

      {/* 🏷️ Top Utility Bar */}
      <div className="top-left-utility">
        <button className="gear-btn" onClick={() => setShowSettings(true)}>⚙️</button>
        <div className="round-badge">ROUND {activeSession?.currentRound || round}/5</div>
      </div>

      {/* 📊 Tooltip Overlay */}
      {hoverInfo && (
        <div className="floating-tile-tooltip">
          <div className="tooltip-header">
            <strong>{hoverInfo.terrain}</strong>
            <span className="coords">({hoverInfo.x}, {hoverInfo.y})</span>
          </div>
          <div className="tooltip-body">
            {previewPath.length > 0 && <p className="distance">Distance: {previewPath.length} cases</p>}
            {TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable && (
              <p className="resource">
                Ressource: 
                <img 
                  src={getResourceIconPath(TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName)} 
                  alt="" 
                  className="inline-res-icon" 
                />
                <strong>{TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName}</strong>
              </p>
            )}
            {!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable && <p className="warning">Inaccessible</p>}
          </div>
        </div>
      )}

      <div className="top-center-container">
        <FarmingTopBar pips={pips} resources={inventoryCounts} />
      </div>

      {/* 🗺️ Main Viewport */}
      <main className="farming-viewport">
        {isReadyToRender && map && (
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
                onTileReached={movePlayer}
                isCameraMoving={isCameraMoving}
                isMoving={isMoving}
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
               <span>❤️ 200</span>
               <span>⚔️ 45</span>
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
          passLabel={amIReady ? 'PRÊT ✓' : 'PRÊT !'}
          isReadyMode={true}
          canPassTurn={!isTransitioning}
          disableGrimoire={true}
        />
      </div>

      {actionMessage && <div className={`map-action-toast ${actionMessage.type}`}>{actionMessage.text}</div>}
    </div>
  );
}

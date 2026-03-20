import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import * as THREE from 'three';
import { TerrainType, CombatActionType, findPath, GameMap, PathNode, TERRAIN_PROPERTIES } from '@game/shared-types';
import { useThree, ThreeEvent, useFrame } from '@react-three/fiber';
import { TerrainTile, TerrainTileProps } from '../ResourceMap/TerrainTile';
import { TileHoverEffect } from '../ResourceMap/TileHoverEffect';
import { PlayerPawn, PlayerPawnHandle } from '../ResourceMap/PlayerPawn';
import { PathPreview } from '../ResourceMap/PathPreview';
import { CombatHighlightsLayer } from './CombatHighlights';
import { SpellVFX } from './overlays/SpellVFX';
import { DamagePopup } from './overlays/DamagePopup';
import { canMoveTo, canJumpTo, isInRange, hasLineOfSight } from '@game/game-engine';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { combatApi } from '../../api/combat.api';

interface UnifiedMapSceneProps {
  mode: 'combat' | 'farming';
  map: GameMap;
  sessionId?: string;
  playerPosition?: PathNode;
  movePath?: PathNode[] | null;
  previewPath?: PathNode[];
  onPathComplete?: () => void;
  onTileClick?: (x: number, y: number, terrain: TerrainType) => void;
  onTileHover?: (info: { x: number; y: number; terrain: TerrainType } | null) => void;
  isCameraMoving?: boolean;
  isMoving?: boolean;
}

export const UnifiedMapScene = React.memo(({
  mode,
  map,
  sessionId,
  playerPosition,
  movePath,
  previewPath,
  onPathComplete,
  onTileClick,
  onTileHover,
  isCameraMoving = false,
  isMoving = false,
}: UnifiedMapSceneProps) => {
  const { combatState, sseConnection, setCombatState } = useCombatStore();
  const [popups, setPopups] = useState<{ id: string; pos: [number, number, number]; val: number }[]>([]);
  const [vfx, setVfx] = useState<{ id: string; type: string; from: { x: number; y: number }; to: { x: number; y: number } }[]>([]);
  const [playerPaths, setPlayerPaths] = useState<Record<string, { x: number; y: number }[]>>({});
  const [jumpingPlayers, setJumpingPlayers] = useState<Record<string, boolean>>({});
  const visualPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const targetPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [visualPositions, setVisualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [mapRotation, setMapRotation] = useState(0);
  const mapGroupRef = useRef<THREE.Group>(null);
  
  const selectedSpellId = useCombatStore((s) => s.selectedSpellId);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  
  const user = useAuthStore((s) => s.player);
  const rightClickStartTimeRef = useRef<number>(0);
  const noop = useCallback(() => { /* noop */ }, []);

  const { raycaster, mouse, camera, scene } = useThree();
  const lastRaycastTimeRef = useRef<number>(0);
  
  // Dictionnaire de refs pour les personnages
  const pawnRefs = useRef(new Map<string, PlayerPawnHandle>());
  const lastSpellCast = useCombatStore((s) => s.lastSpellCast);

  // Écouter les lancers de sorts pour animer les persos
  useEffect(() => {
    if (lastSpellCast && combatState) {
        // 1. Animer le perso (Attaque)
        if (pawnRefs.current.has(lastSpellCast.casterId)) {
            pawnRefs.current.get(lastSpellCast.casterId)?.triggerAttack();
        }

        // 2. Déclencher le projectile si PROJECTILE
        const targetX = Number(lastSpellCast.targetX);
        const targetY = Number(lastSpellCast.targetY);

        if (lastSpellCast.visualType === 'PROJECTILE' && !isNaN(targetX) && !isNaN(targetY)) {
            const caster = combatState.players[lastSpellCast.casterId];
            if (caster && caster.position) {
              setVfx((prev: any) => [...prev, {
                  id: `vfx-${Date.now()}-${Math.random()}`,
                  type: lastSpellCast.spellId.includes('kunai') ? 'spell-kunai' : 'spell-fireball',
                  from: { ...caster.position },
                  to: { x: targetX, y: targetY }
              }]);
            }
        }
    }
  }, [lastSpellCast]);

  const gameMap = useMemo(() => {
    if (mode === 'farming') return map;
    if (!combatState?.map?.tiles) return null;
    const grid = Array(combatState.map.height)
      .fill(0)
      .map(() => Array(combatState.map.width).fill(TerrainType.GROUND));
    combatState.map.tiles.forEach((t) => {
      if (grid[t.y] && grid[t.y][t.x] !== undefined) {
        grid[t.y][t.x] = t.type;
      }
    });
    return { width: combatState.map.width, height: combatState.map.height, grid, seedId: 'FORGE' } as GameMap;
  }, [mode, map, combatState?.map]);

  const activeMap = mode === 'combat' ? gameMap : map;
  const isMyTurn = useMemo(() => {
    if (!combatState || !user) return false;
    const uid = user.id || (user as any)._id;
    return combatState.currentTurnPlayerId === uid;
  }, [combatState, user]);

  const performRaycastHover = useCallback(() => {
    if (!activeMap) return;
    raycaster.setFromCamera(mouse, camera);
    const target = mapGroupRef.current || scene;
    const intersects = raycaster.intersectObjects([target], true);
    // On ignore les objets transparents ou géants pour trouver la tile
    const tileIntersect = intersects.find((i) => (i.object as any).userData?.type === 'terrain-tile');

    if (tileIntersect) {
      const { x, y, terrain } = (tileIntersect.object as any).userData as { x: number; y: number; terrain: TerrainType };
      setHoveredTile((prev) => (prev?.x === x && prev?.y === y) ? prev : { x, y });
      if (mode === 'farming') {
        onTileHover?.({ x, y, terrain });
      }
    } else {
      setHoveredTile(null);
      if (mode === 'farming') {
        onTileHover?.(null);
      }
    }
  }, [mode, onTileHover, raycaster, mouse, camera, scene, activeMap]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    // On autorise maintenant le hover même pendant les mouvements de caméra
    // pour éviter les blocages permanents si le state 'isCameraMoving' se perd.
    
    // Throttle à ~50 FPS pour la perf atomique
    const now = Date.now();
    if (now - lastRaycastTimeRef.current < 20) return;
    lastRaycastTimeRef.current = now;

    performRaycastHover();
  }, [performRaycastHover]);

  useFrame(() => {
    // Rafraîchissement régulier pour capter les changements de state (fin de move, etc.)
    // même si la souris ne bouge pas.
    const now = Date.now();
    if (now - lastRaycastTimeRef.current > 100) { 
      performRaycastHover();
      lastRaycastTimeRef.current = now;
    }
  });

  // Déclenchement manuel si la caméra ou le perso s'arrête, ou si le perso change de case
  // On ne met AUCUNE condition de blocage ici (contrairement au pointerMove) pour servir de "sécurité"
  useEffect(() => {
    performRaycastHover();
  }, [isMoving, playerPosition, playerPaths, isMyTurn, combatState, performRaycastHover]);

  useEffect(() => {
    if (mode !== 'combat' || !sseConnection || !combatState) return;
    const damageHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      const player = combatState.players[data.targetId];
      const gridSize = combatState.map.width;
      const damageVal = Number(data.damage);
      
      if (player && !isNaN(damageVal)) {
        setPopups((prev) => [
          ...prev,
          {
            id: `dmg-${Date.now()}-${Math.random()}`,
            pos: [player.position.x - gridSize / 2 + 0.5, 0.5, player.position.y - gridSize / 2 + 0.5],
            val: damageVal,
          },
        ]);
      }
    };

    const healHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      const player = combatState.players[data.targetId];
      const gridSize = combatState.map.width;
      const healVal = Number(data.heal);
      
      if (player && !isNaN(healVal)) {
        setPopups((prev) => [
          ...prev,
          {
            id: `heal-${Date.now()}-${Math.random()}`,
            pos: [player.position.x - gridSize / 2 + 0.5, 0.5, player.position.y - gridSize / 2 + 0.5],
            val: -healVal, // négatif pour couleur verte dans DamagePopup
          },
        ]);
      }
    };

    const jumpHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.playerId) {
        setJumpingPlayers((prev) => ({ ...prev, [data.playerId]: true }));
        setPlayerPaths((prev) => ({
          ...prev,
          [data.playerId]: [data.from, data.to],
        }));
      }
    };

    sseConnection.addEventListener('DAMAGE_DEALT', damageHandler);
    sseConnection.addEventListener('HEAL_DEALT', healHandler);
    sseConnection.addEventListener('PLAYER_JUMPED', jumpHandler);
    return () => {
      sseConnection.removeEventListener('DAMAGE_DEALT', damageHandler);
      sseConnection.removeEventListener('HEAL_DEALT', healHandler);
      sseConnection.removeEventListener('PLAYER_JUMPED', jumpHandler);
    };
  }, [mode, sseConnection, combatState]);

  useEffect(() => {
    if (mode !== 'combat' || !combatState || !gameMap) return;
    let hasUpdates = false;
    const pathsToAdd: Record<string, PathNode[]> = {};
    
    // Nettoyer les chemins des joueurs qui ne sont plus là
    setPlayerPaths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const pid in next) {
        if (!combatState.players[pid]) {
          delete next[pid];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    Object.values(combatState.players).forEach((p) => {
      const visual = visualPositionsRef.current[p.playerId];
      const target = targetPositionsRef.current[p.playerId];
      if (!visual) {
        visualPositionsRef.current[p.playerId] = p.position;
        targetPositionsRef.current[p.playerId] = p.position;
        hasUpdates = true;
      } else if (target?.x !== p.position.x || target?.y !== p.position.y) {
        // Ne pas écraser si on est déjà en train de sauter
        if (jumpingPlayers[p.playerId]) return;
        
        targetPositionsRef.current[p.playerId] = p.position;
        const path = findPath(gameMap, visual, p.position);
        if (path && path.length > 0) {
          pathsToAdd[p.playerId] = path;
        } else {
          visualPositionsRef.current[p.playerId] = p.position;
          hasUpdates = true;
        }
      }
    });
    if (Object.keys(pathsToAdd).length > 0) {
      setPlayerPaths((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const pid in pathsToAdd) {
          if (!next[pid]) {
            next[pid] = pathsToAdd[pid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
    if (hasUpdates) setVisualPositions({ ...visualPositionsRef.current });
  }, [mode, combatState, gameMap]);

  const occupiedPositions = useMemo(() => {
    if (mode !== 'combat' || !combatState) return [];
    return Object.values(combatState.players).map((p) => p.position);
  }, [mode, combatState]);

  const currentPlayer = useMemo(() => {
    if (mode !== 'combat' || !combatState || !user) return null;
    const uid = user.id || (user as any)._id;
    return combatState.players[uid] || null;
  }, [mode, combatState, user]);

  const reachableTiles = useMemo(() => {
    if (mode !== 'combat' || !isMyTurn || !currentPlayer || !gameMap || !combatState) return [];
    const reachable: { x: number; y: number; dist: number }[] = [];
    const queue: { x: number; y: number; dist: number }[] = [{ ...currentPlayer.position, dist: 0 }];
    const visited = new Set<string>();
    visited.add(`${currentPlayer.position.x},${currentPlayer.position.y}`);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      if (current.dist > 0) reachable.push(current);
      if (current.dist < currentPlayer.remainingPm) {
        for (const dir of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
          const next = { x: current.x + dir.x, y: current.y + dir.y };
          const key = `${next.x},${next.y}`;
          const tile = combatState.map.tiles.find((t) => t.x === next.x && t.y === next.y);
          const isOccupied = occupiedPositions.some((p) => p.x === next.x && p.y === next.y);
          if (next.x >= 0 && next.x < gameMap.width && next.y >= 0 && next.y < gameMap.height && !visited.has(key) && tile && TERRAIN_PROPERTIES[tile.type as TerrainType]?.traversable && !isOccupied) {
            visited.add(key);
            queue.push({ ...next, dist: current.dist + 1 });
          }
        }
      }
    }
    return reachable;
  }, [mode, isMyTurn, currentPlayer, gameMap, occupiedPositions, combatState]);

  const combatPreviewPath = useMemo(() => {
    if (mode !== 'combat' || !isMyTurn || !currentPlayer || !hoveredTile || !gameMap || selectedSpellId) return [];
    let closest: { x: number; y: number } | null = null;
    let minDist = Infinity;
    for (const t of reachableTiles) {
      const d = Math.abs(t.x - hoveredTile.x) + Math.abs(t.y - hoveredTile.y);
      if (d < minDist) {
        minDist = d;
        closest = t;
      }
    }
    if (!closest) return [];
    return findPath(gameMap, currentPlayer.position, closest) ?? [];
  }, [mode, isMyTurn, currentPlayer, hoveredTile, gameMap, selectedSpellId, reachableTiles]);

  const spellRangeTiles = useMemo(() => {
    if (mode !== 'combat' || !currentPlayer || !selectedSpellId || !combatState?.map?.tiles) return [];
    const spell = currentPlayer.spells.find((s) => s.id === selectedSpellId);
    if (!spell) return [];
    
    const result: { x: number; y: number }[] = [];
    for (let y = 0; y < combatState.map.height; y++) {
      for (let x = 0; x < combatState.map.width; x++) {
        const inRange = isInRange(currentPlayer.position, { x, y }, spell.minRange, spell.maxRange);
        if (inRange && (spell.id === 'spell-bond' || hasLineOfSight(currentPlayer.position, { x, y }, combatState.map.tiles))) {
          result.push({ x, y });
        }
      }
    }
    return result;
  }, [mode, currentPlayer, selectedSpellId, combatState?.map?.tiles]);

  const handleCombatTileClick = useCallback(
    async (x: number, y: number) => {
      if (mode !== 'combat' || !sessionId || !isMyTurn || !currentPlayer) return;
      try {
        let res;
        if (selectedSpellId) {
          res = await combatApi.playAction(sessionId, { type: CombatActionType.CAST_SPELL, spellId: selectedSpellId, targetX: x, targetY: y });
          setSelectedSpell(null);
        } else {
          const target = { x, y };
          if (combatState?.map?.tiles && canMoveTo(target, currentPlayer.remainingPm, currentPlayer.position, combatState.map.tiles, occupiedPositions)) {
            res = await combatApi.playAction(sessionId, { type: CombatActionType.MOVE, targetX: x, targetY: y });
          } else if (combatState?.map?.tiles && canJumpTo(target, currentPlayer.remainingPm, currentPlayer.position, combatState.map.tiles, occupiedPositions)) {
            res = await combatApi.playAction(sessionId, { type: CombatActionType.JUMP, targetX: x, targetY: y });
          }
        }
        if (res?.data) setCombatState(res.data);
      } catch (err: unknown) {
        console.error('CombatAction Error:', err);
      }
    },
    [mode, sessionId, isMyTurn, currentPlayer, selectedSpellId, combatState, occupiedPositions, setSelectedSpell, setCombatState, activeMap]
  );

  const handleTileClickDispatcher = useCallback(
    (x: number, y: number, terrain: TerrainType) => {
      if (mode === 'combat') {
        handleCombatTileClick(x, y);
      } else {
        onTileClick?.(x, y, terrain);
      }
    },
    [mode, handleCombatTileClick, onTileClick]
  );

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (e.button === 2) rightClickStartTimeRef.current = Date.now();
  }, []);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (e.button === 2 && mode === 'combat' && selectedSpellId) {
      const duration = Date.now() - rightClickStartTimeRef.current;
      if (duration < 250) setSelectedSpell(null);
    }
  }, [mode, selectedSpellId, setSelectedSpell]);

  useEffect(() => {
    let isDragging = false;
    let prevX = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) {
        isDragging = true;
        prevX = e.clientX;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (isDragging) {
        const delta = e.clientX - prevX;
        setMapRotation(r => r + delta * 0.005);
        prevX = e.clientX;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.button === 0) isDragging = false;
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const tiles = useMemo(() => {
    if (!activeMap) return [];
    console.log('Rebuilding main tile grid (static)...');
    const result: React.ReactElement[] = [];
    for (let y = 0; y < activeMap.height; y++) {
      for (let x = 0; x < activeMap.width; x++) {
        const terrain = activeMap.grid[y][x] as TerrainType;
        const tileProps: TerrainTileProps = {
          x,
          y,
          terrain,
          gridSize: activeMap.width,
          onTileClick: handleTileClickDispatcher,
        };
        result.push(<TerrainTile key={`${x}-${y}`} {...tileProps} />);
      }
    }
    return result;
  }, [mode, activeMap, handleTileClickDispatcher]);

  const renderPlayers = () => {
    if (!activeMap) return null;
    if (mode === 'farming' && playerPosition) {
      return (
        <PlayerPawn
          gridPosition={playerPosition}
          gridSize={activeMap.width}
          path={movePath || null}
          onPathComplete={onPathComplete || noop}
          playerData={{ username: user?.username || 'Joueur' } as any}
        />
      );
    }
    if (mode === 'combat' && combatState) {
      const allPlayers = Object.values(combatState.players);
      return allPlayers.map((p: any) => {
        const pos = visualPositions[p.playerId] || p.position;
        // Trouver l'adversaire (pour lui faire face)
        const opponent = allPlayers.find(opp => opp.playerId !== p.playerId);
        const opponentPos = opponent ? visualPositions[opponent.playerId] || opponent.position : null;

        return (
          <PlayerPawn
            key={p.playerId}
            ref={(el) => {
              if (el) pawnRefs.current.set(p.playerId, el);
              else pawnRefs.current.delete(p.playerId);
            }}
            gridPosition={pos}
            gridSize={activeMap!.width}
            path={playerPaths[p.playerId] || null}
            playerData={p}
            lookAtPosition={opponentPos}
            isJumping={!!jumpingPlayers[p.playerId]}
            onPathComplete={() => {
              setJumpingPlayers((prev) => {
                const next = { ...prev };
                delete next[p.playerId];
                return next;
              });
              setPlayerPaths((prev) => {
                const next = { ...prev };
                delete next[p.playerId];
                return next;
              });
              visualPositionsRef.current[p.playerId] = combatState.players[p.playerId].position;
              targetPositionsRef.current[p.playerId] = combatState.players[p.playerId].position;
              setVisualPositions({ ...visualPositionsRef.current });
            }}
          />
        );
      });
    }
    return null;
  };

  if (!activeMap) return null;
  if (mode === 'combat' && !combatState) return null;

  return (
    <>
      <group 
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown} 
        onPointerUp={handlePointerUp} 
        onContextMenu={(e) => e.nativeEvent.preventDefault()}
      >
        {/* Mesh de fond pour capturer tous les pointerMoves même hors tiles */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        
        <group ref={mapGroupRef} rotation={[0, mapRotation, 0]}>
          {tiles}

          {hoveredTile && activeMap && (
            <TileHoverEffect 
              x={hoveredTile.x} 
              y={hoveredTile.y} 
              terrain={activeMap.grid[hoveredTile.y][hoveredTile.x] as TerrainType} 
              gridSize={activeMap.width} 
            />
          )}

          <Suspense fallback={null}>
            {mode === 'combat' && isMyTurn && (
              <CombatHighlightsLayer 
                reachableTiles={selectedSpellId ? [] : reachableTiles} 
                spellRangeTiles={spellRangeTiles} 
                pathTarget={combatPreviewPath.length > 0 ? combatPreviewPath[combatPreviewPath.length - 1] : null}
                gridSize={activeMap.width} 
              />
            )}

            {mode === 'farming' && previewPath && !isMoving && <PathPreview path={previewPath} gridSize={activeMap.width} />}
            {mode === 'combat' && isMyTurn && user && !playerPaths[user.id || (user as any)._id] && <PathPreview path={combatPreviewPath} gridSize={activeMap.width} />}
            
            {renderPlayers()}

            {mode === 'combat' && (
              <>
                {vfx.map((v) => (
                  <Suspense key={v.id} fallback={null}>
                    <SpellVFX 
                        type={v.type} 
                        from={v.from} 
                        to={v.to} 
                        onComplete={() => setVfx((prev: any[]) => prev.filter((x: any) => x.id !== v.id))} 
                    />
                  </Suspense>
                ))}
                {popups.map((popup) => (
                  <Suspense key={popup.id} fallback={null}>
                    <DamagePopup position={popup.pos} value={popup.val} onComplete={() => setPopups((prev: any[]) => prev.filter((p: any) => p.id !== popup.id))} />
                  </Suspense>
                ))}
              </>
            )}
          </Suspense>
        </group>
      </group>
    </>
  );
});

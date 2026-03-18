import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TerrainType, CombatActionType, findPath, GameMap, PathNode, TERRAIN_PROPERTIES } from '@game/shared-types';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { TerrainTile, TerrainTileProps } from '../ResourceMap/TerrainTile';
import { TileHoverEffect } from '../ResourceMap/TileHoverEffect';
import { PlayerPawn } from '../ResourceMap/PlayerPawn';
import { PathPreview } from '../ResourceMap/PathPreview';
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
  const visualPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const targetPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [visualPositions, setVisualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  
  const selectedSpellId = useCombatStore((s) => s.selectedSpellId);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  
  const user = useAuthStore((s) => s.player);
  const rightClickStartTimeRef = useRef<number>(0);
  const noop = useCallback(() => { /* noop */ }, []);

  const { raycaster, mouse, camera, scene } = useThree();
  const lastRaycastTimeRef = useRef<number>(0);

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
  const isMyTurn = combatState?.currentTurnPlayerId === user?.id;

  const performRaycastHover = useCallback(() => {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    // On ignore les objets transparents ou géants pour trouver la tile
    const tileIntersect = intersects.find((i) => (i.object as any).userData?.type === 'terrain-tile');

    if (tileIntersect) {
      const { x, y, terrain } = (tileIntersect.object as any).userData as { x: number; y: number; terrain: TerrainType };
      setHoveredTile({ x, y });
      if (mode === 'farming') {
        onTileHover?.({ x, y, terrain });
      }
    } else {
      setHoveredTile(null);
      if (mode === 'farming') {
        onTileHover?.(null);
      }
    }
  }, [mode, onTileHover, raycaster, mouse, camera, scene]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    // Si la caméra bouge OU qu'un bouton de souris est pressé (drag), on ne fait rien
    if (isCameraMoving || e.buttons > 0) return;
    
    // Throttle à ~50 FPS pour la perf atomique
    const now = Date.now();
    if (now - lastRaycastTimeRef.current < 20) return;
    lastRaycastTimeRef.current = now;

    performRaycastHover();
  }, [isCameraMoving, performRaycastHover]);

  // Déclenchement manuel si la caméra ou le perso s'arrête, ou si le perso change de case
  // On ne met AUCUNE condition de blocage ici (contrairement au pointerMove) pour servir de "sécurité"
  useEffect(() => {
    performRaycastHover();
  }, [isCameraMoving, isMoving, playerPosition, performRaycastHover]);

  useEffect(() => {
    if (mode !== 'combat' || !sseConnection || !combatState) return;
    const damageHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      const player = combatState.players[data.targetId];
      const gridSize = combatState.map.width;
      if (player) {
        setPopups((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            pos: [player.position.x - gridSize / 2, 0.5, player.position.y - gridSize / 2],
            val: data.damage,
          },
        ]);
      }
    };
    sseConnection.addEventListener('DAMAGE_DEALT', damageHandler);
    return () => sseConnection.removeEventListener('DAMAGE_DEALT', damageHandler);
  }, [mode, sseConnection, combatState]);

  useEffect(() => {
    if (mode !== 'combat' || !combatState || !gameMap) return;
    let hasUpdates = false;
    const pathsToAdd: Record<string, PathNode[]> = {};
    Object.values(combatState.players).forEach((p) => {
      const visual = visualPositionsRef.current[p.playerId];
      const target = targetPositionsRef.current[p.playerId];
      if (!visual) {
        visualPositionsRef.current[p.playerId] = p.position;
        targetPositionsRef.current[p.playerId] = p.position;
        hasUpdates = true;
      } else if (target?.x !== p.position.x || target?.y !== p.position.y) {
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
    return combatState.players[user.id] || null;
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

  const handleCombatTileClick = useCallback(
    async (x: number, y: number) => {
      if (mode !== 'combat' || !sessionId || !isMyTurn || !currentPlayer) return;
      try {
        let res;
        if (selectedSpellId) {
          setVfx((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              type: selectedSpellId,
              from: { x: currentPlayer.position.x - activeMap!.width / 2, y: currentPlayer.position.y - activeMap!.width / 2 },
              to: { x: x - activeMap!.width / 2, y: y - activeMap!.width / 2 },
            },
          ]);
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
        if (mode === 'combat' && isMyTurn && currentPlayer) {
          const pathIndex = combatPreviewPath.findIndex((p: { x: number; y: number }) => p.x === x && p.y === y);
          if (pathIndex !== -1) tileProps.previewColor = '#22c55e';
          if (selectedSpellId) {
            const spell = currentPlayer.spells.find((s) => s.id === selectedSpellId);
            if (spell) {
              tileProps.isInSpellRange =
                isInRange(currentPlayer.position, { x, y }, spell.minRange, spell.maxRange) &&
                (spell.id === 'spell-bond' || (combatState?.map?.tiles && hasLineOfSight(currentPlayer.position, { x, y }, combatState.map.tiles)));
            }
          } else {
            tileProps.isReachable = reachableTiles.some((t: { x: number; y: number }) => t.x === x && t.y === y);
          }
        }
        result.push(<TerrainTile key={`${x}-${y}`} {...tileProps} />);
      }
    }
    return result;
  }, [mode, activeMap, isMyTurn, currentPlayer, selectedSpellId, combatPreviewPath, reachableTiles, combatState?.map?.tiles, handleTileClickDispatcher]);

  const renderPlayers = () => {
    if (!activeMap) return null;
    if (mode === 'farming' && playerPosition) {
      return (
        <PlayerPawn
          gridPosition={playerPosition}
          gridSize={activeMap.width}
          path={movePath || null}
          onPathComplete={onPathComplete || noop}
        />
      );
    }
    if (mode === 'combat' && combatState) {
      return Object.values(combatState.players).map((p: any) => {
        const pos = visualPositions[p.playerId] || p.position;
        return (
          <PlayerPawn
            key={p.playerId}
            gridPosition={pos}
            gridSize={activeMap!.width}
            path={playerPaths[p.playerId] || null}
            onPathComplete={() => {
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
      
      {tiles}

      {/* Hover Effect Layer (Decoupled) */}
      {hoveredTile && activeMap && (
        <TileHoverEffect 
          x={hoveredTile.x} 
          y={hoveredTile.y} 
          terrain={activeMap.grid[hoveredTile.y][hoveredTile.x] as TerrainType} 
          gridSize={activeMap.width} 
        />
      )}

      {mode === 'farming' && previewPath && <PathPreview path={previewPath} gridSize={activeMap.width} />}
      {mode === 'combat' && <PathPreview path={combatPreviewPath} gridSize={activeMap.width} />}
      {renderPlayers()}
      {mode === 'combat' && vfx.map((v) => (
        <SpellVFX key={v.id} type={v.type} from={v.from} to={v.to} onComplete={() => setVfx((prev: any[]) => prev.filter((x: any) => x.id !== v.id))} />
      ))}
      {mode === 'combat' && popups.map((popup) => (
        <DamagePopup key={popup.id} position={popup.pos} value={popup.val} onComplete={() => setPopups((prev: any[]) => prev.filter((p: any) => p.id !== popup.id))} />
      ))}
    </group>
  );
});

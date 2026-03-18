import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TerrainType, CombatActionType, findPath, GameMap, PathNode, TERRAIN_PROPERTIES } from '@game/shared-types';
import { ThreeEvent } from '@react-three/fiber';
import { TerrainTile, TerrainTileProps } from '../ResourceMap/TerrainTile';
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
  
  // Props communs
  map: GameMap;
  
  // Props combat
  sessionId?: string;
  
  // Props farming
  playerPosition?: PathNode;
  movePath?: PathNode[] | null;
  previewPath?: PathNode[];
  onPathComplete?: () => void;
  onTileClick?: (x: number, y: number, terrain: TerrainType) => void;
  onTileHover?: (info: { x: number; y: number; terrain: TerrainType } | null) => void;
}

export function UnifiedMapScene({
  mode,
  map,
  sessionId,
  playerPosition,
  movePath,
  previewPath,
  onPathComplete,
  onTileClick,
  onTileHover,
}: UnifiedMapSceneProps) {
  // === Combat State ===
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
  const noop = useCallback(() => {}, []);


  // === Combat: Listener dégâts ===
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

  // === Combat: Conversion map ===
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

  // === Combat: Positions occupées ===
  const occupiedPositions = useMemo(() => {
    if (mode !== 'combat' || !combatState) return [];
    return Object.values(combatState.players).map((p) => p.position);
  }, [mode, combatState]);

  // === Combat: Joueur actuel ===
  const currentPlayer = useMemo(() => {
    if (mode !== 'combat' || !combatState || !user) return null;
    return combatState.players[user.id] || null;
  }, [mode, combatState, user]);

  const isMyTurn = combatState?.currentTurnPlayerId === user?.id;

  // === Combat: Détection mouvements joueurs ===
  useEffect(() => {
    if (mode !== 'combat' || !combatState || !gameMap) return;

    let hasUpdates = false;
    const pathsToAdd: Record<string, PathNode[]> = {};

    Object.values(combatState.players).forEach((p) => {
      const visual = visualPositionsRef.current[p.playerId];
      const target = targetPositionsRef.current[p.playerId];
      
      // Si la position a changé depuis notre dernier calcul
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
          // Téléportation immédiate si pas de chemin (ex: bond ou erreur)
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

    if (hasUpdates) {
      setVisualPositions({ ...visualPositionsRef.current });
    }
  }, [mode, combatState, gameMap]);

  // === Combat: Tuiles accessibles ===
  const reachableTiles = useMemo(() => {
    if (mode !== 'combat' || !isMyTurn || !currentPlayer || !gameMap || !combatState) return [];

    const reachable: { x: number; y: number; dist: number }[] = [];
    const queue: { x: number; y: number; dist: number }[] = [{ ...currentPlayer.position, dist: 0 }];
    const visited = new Set<string>();
    visited.add(`${currentPlayer.position.x},${currentPlayer.position.y}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.dist > 0) reachable.push(current);

      if (current.dist < currentPlayer.remainingPm) {
        for (const dir of [
          { x: 0, y: 1 },
          { x: 0, y: -1 },
          { x: 1, y: 0 },
          { x: -1, y: 0 },
        ]) {
          const next = { x: current.x + dir.x, y: current.y + dir.y };
          const key = `${next.x},${next.y}`;
          const tile = combatState.map.tiles.find((t) => t.x === next.x && t.y === next.y);
          const isOccupied = occupiedPositions.some((p) => p.x === next.x && p.y === next.y);

          if (
            next.x >= 0 &&
            next.x < gameMap.width &&
            next.y >= 0 &&
            next.y < gameMap.height &&
            !visited.has(key) &&
            tile &&
            TERRAIN_PROPERTIES[tile.type as TerrainType]?.traversable &&
            !isOccupied
          ) {
            visited.add(key);
            queue.push({ ...next, dist: current.dist + 1 });
          }
        }
      }
    }
    return reachable;
  }, [mode, isMyTurn, currentPlayer, gameMap, occupiedPositions, combatState]);

  // === Combat: Aperçu chemin ===
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

  // === Combat: Click handler ===
  const handleCombatTileClick = useCallback(
    async (x: number, y: number) => {
      if (mode !== 'combat' || !sessionId || !isMyTurn || !currentPlayer) return;

      try {
        let res;
        if (selectedSpellId) {
          console.log('Casting spell', selectedSpellId, 'at', { x, y });

            setVfx((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              type: selectedSpellId,
              from: { x: currentPlayer.position.x - gameMap!.width / 2, y: currentPlayer.position.y - gameMap!.width / 2 },
              to: { x: x - gameMap!.width / 2, y: y - gameMap!.width / 2 },
            },
          ]);

          res = await combatApi.playAction(sessionId, {
            type: CombatActionType.CAST_SPELL,
            spellId: selectedSpellId,
            targetX: x,
            targetY: y,
          });
          setSelectedSpell(null);
        } else {
          const target = { x, y };
          console.log('Moving to', target);
          if (canMoveTo(target, currentPlayer.remainingPm, currentPlayer.position, combatState!.map.tiles, occupiedPositions)) {
            res = await combatApi.playAction(sessionId, {
              type: CombatActionType.MOVE,
              targetX: x,
              targetY: y,
            });
          } else if (canJumpTo(target, currentPlayer.remainingPm, currentPlayer.position, combatState!.map.tiles, occupiedPositions)) {
            res = await combatApi.playAction(sessionId, {
              type: CombatActionType.JUMP,
              targetX: x,
              targetY: y,
            });
          } else {
            console.warn('Position unreachable');
          }
        }

        if (res?.data) {
          setCombatState(res.data);
        }
      } catch (err: unknown) {
        console.error('CombatAction Error:', err);
      }
    },
    [mode, sessionId, isMyTurn, currentPlayer, selectedSpellId, combatState, occupiedPositions, setSelectedSpell, setCombatState]
  );

  // === Tile Click Dispatcher ===
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

  // === Tile Hover Handler ===
  const handleTileHoverDispatcher = useCallback(
    (hovered: boolean, x: number, y: number, terrain: TerrainType) => {
      if (mode === 'combat') {
        setHoveredTile(hovered ? { x, y } : null);
      } else {
        onTileHover?.(hovered ? { x, y, terrain } : null);
      }
    },
    [mode, onTileHover]
  );

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (e.button === 2) { // Right click
      rightClickStartTimeRef.current = Date.now();
    }
  }, []);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (e.button === 2 && mode === 'combat' && selectedSpellId) {
      const duration = Date.now() - rightClickStartTimeRef.current;
      if (duration < 250) { // Simple click, not hold
        setSelectedSpell(null);
      }
    }
  }, [mode, selectedSpellId, setSelectedSpell]);

  // === Render Map ===
  if (mode === 'combat' && !combatState) {
    return null;
  }

  const activeMap = mode === 'combat' ? gameMap : map;
  if (!activeMap) return null;

  const tiles: React.ReactElement[] = [];
  for (let y = 0; y < activeMap.height; y++) {
    for (let x = 0; x < activeMap.width; x++) {
      const terrain = activeMap.grid[y][x] as TerrainType;
      
      // Combat: calculer les props spécifiques
      const tileProps: TerrainTileProps = {
        x,
        y,
        terrain,
        gridSize: activeMap.width,
        onTileClick: handleTileClickDispatcher,
        onTileHover: (info: { x: number; y: number; terrain: TerrainType } | null) => handleTileHoverDispatcher(!!info, x, y, terrain),
      };

      if (mode === 'combat' && isMyTurn && currentPlayer) {
        const pathIndex = combatPreviewPath.findIndex((p) => p.x === x && p.y === y);
        if (pathIndex !== -1) {
          tileProps.previewColor = '#22c55e';
        }

        if (selectedSpellId) {
          const spell = currentPlayer.spells.find((s) => s.id === selectedSpellId);
          if (spell) {
            tileProps.isInSpellRange =
              isInRange(currentPlayer.position, { x, y }, spell.minRange, spell.maxRange) &&
              (spell.id === 'spell-bond' || hasLineOfSight(currentPlayer.position, { x, y }, combatState!.map.tiles));
          }
        } else {
          // Si aucun sort n'est sélectionné, on affiche la zone de mouvement
          tileProps.isReachable = reachableTiles.some((t) => t.x === x && t.y === y);
        }
      }

      tiles.push(<TerrainTile key={`${x}-${y}`} {...tileProps} />);
    }
  }

  // === Render Players ===
  const renderPlayers = () => {
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
      return Object.values(combatState.players).map((p) => {
        const pos = visualPositions[p.playerId] || p.position;
        return (
          <PlayerPawn
            key={p.playerId}
            gridPosition={pos}
            gridSize={activeMap.width}
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

  return (
    <group 
      onPointerDown={handlePointerDown} 
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.nativeEvent.preventDefault()}
    >
      {/* Background click catcher */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {tiles}

      {/* Path preview */}
      {mode === 'farming' && previewPath && <PathPreview path={previewPath} gridSize={activeMap.width} />}
      {mode === 'combat' && <PathPreview path={combatPreviewPath} gridSize={activeMap.width} />}

      {/* Players */}
      {renderPlayers()}

      {/* Combat VFX */}
      {mode === 'combat' &&
        vfx.map((v) => (
          <SpellVFX
            key={v.id}
            type={v.type}
            from={v.from}
            to={v.to}
            onComplete={() => setVfx((prev) => prev.filter((x) => x.id !== v.id))}
          />
        ))}

      {/* Combat Damage Popups */}
      {mode === 'combat' &&
        popups.map((popup) => (
          <DamagePopup
            key={popup.id}
            position={popup.pos}
            value={popup.val}
            onComplete={() => setPopups((prev) => prev.filter((p) => p.id !== popup.id))}
          />
        ))}
    </group>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  CombatActionType,
  GameMap,
  PathNode,
  TERRAIN_PROPERTIES,
  TerrainType,
  findPath,
} from '@game/shared-types';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { canJumpTo, canMoveTo, hasLineOfSight, isInRange } from '@game/game-engine';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { combatApi } from '../../api/combat.api';
import {
  HoverLayer,
  PlayersLayer,
  TerrainLayer,
  TransientEffectsLayer,
  UnifiedMapOverlayLayer,
} from './UnifiedMapLayers';
import {
  buildOccupiedPositionSet,
  buildTileIndex,
  toPositionKey,
} from './unifiedMap.utils';
import { PlayerPawnHandle } from '../ResourceMap/PlayerPawn';

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
  onTileReached?: (node: PathNode) => void;
}

function getProjectileType(spellId: string) {
  if (spellId.includes('kunai')) {
    return 'spell-kunai';
  }

  return 'spell-fireball';
}

export const UnifiedMapScene = React.memo(
  ({
    mode,
    map,
    sessionId,
    playerPosition,
    movePath,
    previewPath,
    onPathComplete,
    onTileClick,
    onTileHover,
    isMoving = false,
    onTileReached,
  }: UnifiedMapSceneProps) => {
    const combatState = useCombatStore((state) => state.combatState);
    const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
    const setSelectedSpell = useCombatStore((state) => state.setSelectedSpell);
    const setCombatState = useCombatStore((state) => state.setCombatState);
    const lastSpellCast = useCombatStore((state) => state.lastSpellCast);
    const lastDamageEvent = useCombatStore((state) => state.lastDamageEvent);
    const lastHealEvent = useCombatStore((state) => state.lastHealEvent);
    const lastJumpEvent = useCombatStore((state) => state.lastJumpEvent);
    const setUiMessage = useCombatStore((state) => state.setUiMessage);

    const user = useAuthStore((state) => state.player);

    const [popups, setPopups] = useState<{ id: string; pos: [number, number, number]; val: number }[]>([]);
    const [vfx, setVfx] = useState<{ id: string; type: string; from: { x: number; y: number }; to: { x: number; y: number } }[]>([]);
    const [playerPaths, setPlayerPaths] = useState<Record<string, PathNode[]>>({});
    const [jumpingPlayers, setJumpingPlayers] = useState<Record<string, boolean>>({});
    const [visualPositions, setVisualPositions] = useState<Record<string, PathNode>>({});
    const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
    const [mapRotation, setMapRotation] = useState(0);

    const visualPositionsRef = useRef<Record<string, PathNode>>({});
    const targetPositionsRef = useRef<Record<string, PathNode>>({});
    const mapGroupRef = useRef<THREE.Group>(null);
    const pawnRefs = useRef(new Map<string, PlayerPawnHandle>());
    const rightClickStartTimeRef = useRef(0);
    const lastRaycastTimeRef = useRef(0);
    const processedTimestampsRef = useRef(new Set<number>());
    const inputProcessingLock = useRef(false);

    const { raycaster, mouse, camera, scene } = useThree();

    const currentUserId = user?.id ?? (user as { _id?: string } | null)?._id ?? null;

    const gameMap = useMemo(() => {
      if (mode === 'farming') return map;
      if (!combatState?.map?.tiles) return null;

      const grid = Array.from({ length: combatState.map.height }, () =>
        Array(combatState.map.width).fill(TerrainType.GROUND),
      );

      combatState.map.tiles.forEach((tile) => {
        if (grid[tile.y]?.[tile.x] !== undefined) {
          grid[tile.y][tile.x] = tile.type;
        }
      });

      return {
        width: combatState.map.width,
        height: combatState.map.height,
        grid,
        seedId: 'FORGE',
      } as GameMap;
    }, [mode, map, combatState]);

    const activeMap = mode === 'combat' ? gameMap : map;
    const combatPlayers = useMemo(
      () => (mode === 'combat' && combatState ? Object.values(combatState.players) : []),
      [mode, combatState],
    );
    const combatTiles = combatState?.map?.tiles ?? [];
    const tileIndex = useMemo(() => buildTileIndex(combatTiles), [combatTiles]);
    const occupiedPositions = useMemo(() => combatPlayers.map((player) => player.position), [combatPlayers]);
    const occupiedPositionSet = useMemo(
      () => buildOccupiedPositionSet(occupiedPositions),
      [occupiedPositions],
    );

    const isMyTurn = useMemo(() => {
      if (!combatState || !currentUserId) return false;
      return combatState.currentTurnPlayerId === currentUserId;
    }, [combatState, currentUserId]);

    const currentPlayer = useMemo(() => {
      if (!combatState || !currentUserId) return null;
      return combatState.players[currentUserId] || null;
    }, [combatState, currentUserId]);

    const performRaycastHover = useCallback(() => {
      if (!activeMap) return;

      raycaster.setFromCamera(mouse, camera);
      const target = mapGroupRef.current || scene;
      const intersects = raycaster.intersectObjects([target], true);
      const tileIntersect = intersects.find(
        (intersection) =>
          typeof intersection.object.userData === 'object' &&
          intersection.object.userData?.type === 'terrain-tile',
      );

      if (!tileIntersect) {
        setHoveredTile(null);
        if (mode === 'farming') onTileHover?.(null);
        return;
      }

      const { x, y, terrain } = tileIntersect.object.userData as {
        x: number;
        y: number;
        terrain: TerrainType;
      };

      setHoveredTile((previous) => (previous?.x === x && previous?.y === y ? previous : { x, y }));

      if (mode === 'farming') {
        onTileHover?.({ x, y, terrain });
      }
    }, [activeMap, camera, mode, mouse, onTileHover, raycaster, scene]);

    const handlePointerMove = useCallback(() => {
      const now = Date.now();
      if (now - lastRaycastTimeRef.current < 32) return;
      lastRaycastTimeRef.current = now;
      performRaycastHover();
    }, [performRaycastHover]);

    useEffect(() => {
      performRaycastHover();
    }, [performRaycastHover, isMoving, playerPosition, playerPaths, isMyTurn, combatState]);

    useEffect(() => {
      if (!lastSpellCast || !combatState) return;
      if (processedTimestampsRef.current.has(lastSpellCast.timestamp)) return;
      processedTimestampsRef.current.add(lastSpellCast.timestamp);

      pawnRefs.current.get(lastSpellCast.casterId)?.triggerAttack();

      const targetX = Number(lastSpellCast.targetX);
      const targetY = Number(lastSpellCast.targetY);
      const caster = combatState.players[lastSpellCast.casterId];

      if (
        lastSpellCast.visualType === 'PROJECTILE' &&
        !Number.isNaN(targetX) &&
        !Number.isNaN(targetY) &&
        caster
      ) {
        setVfx((current) => [
          ...current,
          {
            id: `vfx-${lastSpellCast.timestamp}`,
            type: getProjectileType(lastSpellCast.spellId),
            from: { ...caster.position },
            to: { x: targetX, y: targetY },
          },
        ]);
      }
    }, [combatState, lastSpellCast]);

    useEffect(() => {
      if (!lastDamageEvent || !combatState) return;
      if (processedTimestampsRef.current.has(lastDamageEvent.timestamp)) return;
      processedTimestampsRef.current.add(lastDamageEvent.timestamp);

      const player = combatState.players[lastDamageEvent.targetId];
      if (!player) return;

      setPopups((current) => [
        ...current,
        {
          id: `dmg-${lastDamageEvent.timestamp}`,
          pos: [
            player.position.x - combatState.map.width / 2 + 0.5,
            0.5,
            player.position.y - combatState.map.width / 2 + 0.5,
          ],
          val: Number(lastDamageEvent.damage),
        },
      ]);
    }, [combatState, lastDamageEvent]);

    useEffect(() => {
      if (!lastHealEvent || !combatState) return;
      if (processedTimestampsRef.current.has(lastHealEvent.timestamp)) return;
      processedTimestampsRef.current.add(lastHealEvent.timestamp);

      const player = combatState.players[lastHealEvent.targetId];
      if (!player) return;

      setPopups((current) => [
        ...current,
        {
          id: `heal-${lastHealEvent.timestamp}`,
          pos: [
            player.position.x - combatState.map.width / 2 + 0.5,
            0.5,
            player.position.y - combatState.map.width / 2 + 0.5,
          ],
          val: -Number(lastHealEvent.heal),
        },
      ]);
    }, [combatState, lastHealEvent]);

    useEffect(() => {
      if (!lastJumpEvent) return;
      if (processedTimestampsRef.current.has(lastJumpEvent.timestamp)) return;
      processedTimestampsRef.current.add(lastJumpEvent.timestamp);

      setJumpingPlayers((current) => ({ ...current, [lastJumpEvent.playerId]: true }));
      setPlayerPaths((current) => ({
        ...current,
        [lastJumpEvent.playerId]: [lastJumpEvent.from, lastJumpEvent.to],
      }));
    }, [lastJumpEvent]);

    useEffect(() => {
      if (mode !== 'combat' || !combatState || !gameMap) return;

      let hasVisualUpdates = false;
      const newPaths: Record<string, PathNode[]> = {};

      setPlayerPaths((current) => {
        let changed = false;
        const next = { ...current };

        Object.keys(next).forEach((playerId) => {
          if (!combatState.players[playerId]) {
            delete next[playerId];
            changed = true;
          }
        });

        return changed ? next : current;
      });

      combatPlayers.forEach((player) => {
        const visualPosition = visualPositionsRef.current[player.playerId];
        const targetPosition = targetPositionsRef.current[player.playerId];

        if (!visualPosition) {
          visualPositionsRef.current[player.playerId] = player.position;
          targetPositionsRef.current[player.playerId] = player.position;
          hasVisualUpdates = true;
          return;
        }

        if (targetPosition?.x === player.position.x && targetPosition?.y === player.position.y) {
          return;
        }

        if (jumpingPlayers[player.playerId]) {
          return;
        }

        targetPositionsRef.current[player.playerId] = player.position;
        
        // On exclut la position cible du joueur lui-même pour que le pathfinder accepte d'y aller
        const filteredOccupied = new Set(occupiedPositionSet);
        filteredOccupied.delete(toPositionKey(player.position.x, player.position.y));
        
        const path = findPath(gameMap, visualPosition, player.position, filteredOccupied);

        if (path && path.length > 0) {
          newPaths[player.playerId] = path;
          return;
        }

        visualPositionsRef.current[player.playerId] = player.position;
        hasVisualUpdates = true;
      });

      if (Object.keys(newPaths).length > 0) {
        setPlayerPaths((current) => {
          const next = { ...current };
          let changed = false;

          Object.entries(newPaths).forEach(([playerId, path]) => {
            if (!next[playerId]) {
              next[playerId] = path;
              changed = true;
            }
          });

          return changed ? next : current;
        });
      }

      if (hasVisualUpdates) {
        setVisualPositions({ ...visualPositionsRef.current });
      }
    }, [combatPlayers, combatState, gameMap, jumpingPlayers, mode]);

    const reachableTiles = useMemo(() => {
      if (mode !== 'combat' || !isMyTurn || !currentPlayer || !gameMap) return [];

      const reachable: { x: number; y: number; dist: number }[] = [];
      const queue: { x: number; y: number; dist: number }[] = [
        { ...currentPlayer.position, dist: 0 },
      ];
      const visited = new Set([toPositionKey(currentPlayer.position.x, currentPlayer.position.y)]);

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;

        if (current.dist > 0) {
          reachable.push(current);
        }

        if (current.dist >= currentPlayer.remainingPm) {
          continue;
        }

        for (const direction of [
          { x: 0, y: 1 },
          { x: 0, y: -1 },
          { x: 1, y: 0 },
          { x: -1, y: 0 },
        ]) {
          const next = { x: current.x + direction.x, y: current.y + direction.y };
          const key = toPositionKey(next.x, next.y);

          if (
            next.x < 0 ||
            next.x >= gameMap.width ||
            next.y < 0 ||
            next.y >= gameMap.height
          ) {
            continue;
          }

          const tile = tileIndex.get(key);
          const isCurrentPlayerTile =
            next.x === currentPlayer.position.x && next.y === currentPlayer.position.y;
          const isOccupied = !isCurrentPlayerTile && occupiedPositionSet.has(key);

          if (tile && TERRAIN_PROPERTIES[tile.type].traversable && !isOccupied) {
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ ...next, dist: current.dist + 1 });
            }
          }

          if (tile && TERRAIN_PROPERTIES[tile.type].jumpable) {
            const jumpNext = { x: current.x + direction.x * 2, y: current.y + direction.y * 2 };
            const jumpKey = toPositionKey(jumpNext.x, jumpNext.y);

            if (
              jumpNext.x >= 0 &&
              jumpNext.x < gameMap.width &&
              jumpNext.y >= 0 &&
              jumpNext.y < gameMap.height
            ) {
              const jumpTile = tileIndex.get(jumpKey);
              const isJumpOccupied = occupiedPositionSet.has(jumpKey);

              if (jumpTile && TERRAIN_PROPERTIES[jumpTile.type].traversable && !isJumpOccupied) {
                if (!visited.has(jumpKey)) {
                  visited.add(jumpKey);
                  queue.push({ ...jumpNext, dist: current.dist + 1 });
                }
              }
            }
          }
        }
      }

      return reachable;
    }, [currentPlayer, gameMap, isMyTurn, mode, occupiedPositionSet, tileIndex]);

    const combatPreviewPath = useMemo(() => {
      if (mode !== 'combat' || !isMyTurn || !currentPlayer || !hoveredTile || !gameMap || selectedSpellId) {
        return [];
      }

      let closestTile: { x: number; y: number } | null = null;
      let minDistance = Infinity;

      reachableTiles.forEach((tile) => {
        const distance = Math.abs(tile.x - hoveredTile.x) + Math.abs(tile.y - hoveredTile.y);
        if (distance < minDistance) {
          minDistance = distance;
          closestTile = tile;
        }
      });

      if (!closestTile) return [];

      // Pour la preview du trajet, on exclut le joueur local du set d'obstacles pour ne pas bloquer le point de départ
      const obstacles = new Set(occupiedPositionSet);
      if (currentUserId) obstacles.delete(toPositionKey(currentPlayer.position.x, currentPlayer.position.y));

      return findPath(gameMap, currentPlayer.position, closestTile, obstacles) ?? [];
    }, [currentPlayer, gameMap, hoveredTile, isMyTurn, mode, reachableTiles, selectedSpellId]);

    const spellRangeTiles = useMemo(() => {
      if (mode !== 'combat' || !currentPlayer || !selectedSpellId || !combatState?.map?.tiles) {
        return [];
      }

      const spell = currentPlayer.spells.find((candidate) => candidate.id === selectedSpellId);
      if (!spell) return [];

      const tilesInRange: { x: number; y: number }[] = [];

      for (let y = 0; y < combatState.map.height; y++) {
        for (let x = 0; x < combatState.map.width; x++) {
          const target = { x, y };
          const targetInRange = isInRange(
            currentPlayer.position,
            target,
            spell.minRange,
            spell.maxRange,
          );

          if (
            targetInRange &&
            (!spell.requiresLineOfSight || hasLineOfSight(currentPlayer.position, target, combatState.map.tiles)) &&
            (!spell.requiresLinearTargeting ||
              currentPlayer.position.x === target.x ||
              currentPlayer.position.y === target.y)
          ) {
            tilesInRange.push(target);
          }
        }
      }

      return tilesInRange;
    }, [combatState, currentPlayer, mode, selectedSpellId]);

    const handleCombatTileClick = useCallback(
      async (x: number, y: number) => {
        if (mode !== 'combat' || !sessionId || !isMyTurn || !currentPlayer || !combatState) return;
        if (inputProcessingLock.current) return;

        try {
          inputProcessingLock.current = true;
          let response;

          if (selectedSpellId) {
            response = await combatApi.playAction(sessionId, {
              type: CombatActionType.CAST_SPELL,
              spellId: selectedSpellId,
              targetX: x,
              targetY: y,
            });
            setSelectedSpell(null);
          } else {
            const target = { x, y };

            if (canMoveTo(target, currentPlayer.remainingPm, currentPlayer.position, combatState.map.tiles, occupiedPositions)) {
              response = await combatApi.playAction(sessionId, {
                type: CombatActionType.MOVE,
                targetX: x,
                targetY: y,
              });
            } else if (
              canJumpTo(target, currentPlayer.remainingPm, currentPlayer.position, combatState.map.tiles, occupiedPositions)
            ) {
              response = await combatApi.playAction(sessionId, {
                type: CombatActionType.JUMP,
                targetX: x,
                targetY: y,
              });
            } else {
              setUiMessage('Action impossible sur cette case.', 'error');
              return;
            }
          }

          if (response?.data) {
            setCombatState(response.data);
          }
        } catch (error) {
          console.error('CombatAction Error:', error);
          const message =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
              ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
              : "L'action a échoué.";

          setUiMessage(message ?? "L'action a échoué.", 'error');
        } finally {
          inputProcessingLock.current = false;
        }
      },
      [
        combatState,
        currentPlayer,
        isMyTurn,
        mode,
        occupiedPositions,
        selectedSpellId,
        sessionId,
        setCombatState,
        setSelectedSpell,
        setUiMessage,
      ],
    );

    const handleTileClickDispatcher = useCallback(
      (x: number, y: number, terrain: TerrainType) => {
        if (mode === 'combat') {
          void handleCombatTileClick(x, y);
          return;
        }

        onTileClick?.(x, y, terrain);
      },
      [handleCombatTileClick, mode, onTileClick],
    );

    const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
      if (event.button === 2) {
        rightClickStartTimeRef.current = Date.now();
      }
    }, []);

    const handlePointerUp = useCallback(
      (event: ThreeEvent<PointerEvent>) => {
        if (event.button === 2 && mode === 'combat' && selectedSpellId) {
          const duration = Date.now() - rightClickStartTimeRef.current;
          if (duration < 250) {
            setSelectedSpell(null);
          }
        }
      },
      [mode, selectedSpellId, setSelectedSpell],
    );

    useEffect(() => {
      let isDragging = false;
      let previousX = 0;

      const onPointerDown = (event: PointerEvent) => {
        if (event.button === 0) {
          isDragging = true;
          previousX = event.clientX;
        }
      };

      const onPointerMoveWindow = (event: PointerEvent) => {
        if (!isDragging) return;

        const delta = event.clientX - previousX;
        setMapRotation((current) => current + delta * 0.005);
        previousX = event.clientX;
      };

      const onPointerUpWindow = (event: PointerEvent) => {
        if (event.button === 0) {
          isDragging = false;
        }
      };

      window.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMoveWindow);
      window.addEventListener('pointerup', onPointerUpWindow);

      return () => {
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMoveWindow);
        window.removeEventListener('pointerup', onPointerUpWindow);
      };
    }, []);

    const setPawnRef = useCallback((playerId: string, handle: PlayerPawnHandle | null) => {
      if (handle) {
        pawnRefs.current.set(playerId, handle);
      } else {
        pawnRefs.current.delete(playerId);
      }
    }, []);

    const handleCombatPathComplete = useCallback(
      (playerId: string) => {
        setJumpingPlayers((current) => {
          const next = { ...current };
          delete next[playerId];
          return next;
        });

        setPlayerPaths((current) => {
          const next = { ...current };
          delete next[playerId];
          return next;
        });

        const finalPosition = combatState?.players[playerId]?.position;
        if (finalPosition) {
          visualPositionsRef.current[playerId] = finalPosition;
          targetPositionsRef.current[playerId] = finalPosition;
          setVisualPositions({ ...visualPositionsRef.current });
        }
      },
      [combatState],
    );

    const removeVfx = useCallback((effectId: string) => {
      setVfx((current) => current.filter((effect) => effect.id !== effectId));
    }, []);

    const removePopup = useCallback((popupId: string) => {
      setPopups((current) => current.filter((popup) => popup.id !== popupId));
    }, []);

    if (!activeMap) return null;
    if (mode === 'combat' && !combatState) return null;

    return (
      <group
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onContextMenu={(event) => event.nativeEvent.preventDefault()}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        <group ref={mapGroupRef} rotation={[0, mapRotation, 0]}>
          <TerrainLayer map={activeMap} onTileClick={handleTileClickDispatcher} />
          <HoverLayer hoveredTile={hoveredTile} map={activeMap} />

          <UnifiedMapOverlayLayer
            mode={mode}
            isMyTurn={isMyTurn}
            selectedSpellId={selectedSpellId}
            reachableTiles={reachableTiles}
            spellRangeTiles={spellRangeTiles}
            combatPreviewPath={combatPreviewPath}
            previewPath={previewPath}
            isMoving={isMoving}
            map={activeMap}
            currentUserId={currentUserId ?? undefined}
            playerPaths={playerPaths}
          />

          <PlayersLayer
            mode={mode}
            mapWidth={activeMap.width}
            playerPosition={playerPosition}
            movePath={movePath}
            onPathComplete={onPathComplete}
            farmingPlayerName={user?.username || 'Joueur'}
            farmingPlayerSkin={user?.skin}
            combatPlayers={combatPlayers}
            visualPositions={visualPositions}
            playerPaths={playerPaths}
            jumpingPlayers={jumpingPlayers}
            setPawnRef={setPawnRef}
            onCombatPathComplete={handleCombatPathComplete}
            onTileReached={onTileReached}
          />

          {mode === 'combat' && (
            <TransientEffectsLayer
              vfx={vfx}
              popups={popups}
              onRemoveVfx={removeVfx}
              onRemovePopup={removePopup}
            />
          )}
        </group>
      </group>
    );
  },
);

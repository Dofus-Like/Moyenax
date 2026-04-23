import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  CombatActionType,
  GameMap,
  PathNode,
  TERRAIN_PROPERTIES,
  TerrainType,
  findPath,
} from '@game/shared-types';
import { Castle } from '../ResourceMap/Castle';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { canJumpTo, canMoveTo, hasLineOfSight, isInRange } from '@game/game-engine';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { useControls, button, folder } from 'leva';
import { COMBAT_COLORS } from '../constants/colors';
import { combatApi } from '../../api/combat.api';
import {
  HoverLayer,
  PlayersLayer,
  TerrainLayer,
  TransientEffectsLayer,
  UnifiedMapOverlayLayer,
} from './UnifiedMapLayers';
import { buildOccupiedPositionSet, buildTileIndex, toPositionKey } from './unifiedMap.utils';
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

    const [popups, setPopups] = useState<
      { id: string; pos: [number, number, number]; val: number }[]
    >([]);
    const [vfx, setVfx] = useState<
      { id: string; type: string; from: { x: number; y: number }; to: { x: number; y: number } }[]
    >([]);
    const [playerPaths, setPlayerPaths] = useState<Record<string, PathNode[]>>({});
    const [jumpingPlayers, setJumpingPlayers] = useState<Record<string, boolean>>({});
    const [visualPositions, setVisualPositions] = useState<Record<string, PathNode>>({});
    const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
    const deferredHoveredTile = React.useDeferredValue(hoveredTile);
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
    const [mapRotation, setMapRotation] = useState(0);

    const visualPositionsRef = useRef<Record<string, PathNode>>({});
    const targetPositionsRef = useRef<Record<string, PathNode>>({});
    const mapGroupRef = useRef<THREE.Group>(null);
    const pawnRefs = useRef(new Map<string, PlayerPawnHandle>());
    const rightClickStartTimeRef = useRef(0);
    const lastRaycastTimeRef = useRef(0);
    const wasDraggingRef = useRef(false);
    const dragDistanceRef = useRef(0);
    const processedTimestampsRef = useRef(new Set<number>());
    const inputProcessingLock = useRef(false);

    const { raycaster, mouse, camera, scene } = useThree();

    const currentUserId = user?.id ?? (user as { _id?: string } | null)?._id ?? undefined;

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

    // Global time of day sync
    const { timeOfDay } = useControls(
      'Background Shader',
      {
        timeOfDay: { value: 0, min: 0, max: 2, step: 1 },
      },
      { collapsed: true },
    );

    // Debug controls for the tiles per phase
    const tileConfig = useControls('Background Shader', {
      'Tile Colors': folder({
        tileDayA: { value: COMBAT_COLORS.TILE_DAY_A },
        tileDayB: { value: COMBAT_COLORS.TILE_DAY_B },
        tileSideDay: { value: COMBAT_COLORS.TILE_SIDE_DAY },
        tileSunA: { value: COMBAT_COLORS.TILE_SUNSET_A },
        tileSunB: { value: COMBAT_COLORS.TILE_SUNSET_B },
        tileSideSun: { value: COMBAT_COLORS.TILE_SIDE_SUNSET },
        tileNightA: { value: COMBAT_COLORS.TILE_NIGHT_A },
        tileNightB: { value: COMBAT_COLORS.TILE_NIGHT_B },
        tileSideNight: { value: COMBAT_COLORS.TILE_SIDE_NIGHT },
      }),
      'Tile Settings': folder({
        tileSize: { value: 0.95, min: 0.8, max: 1.0, step: 0.01 },
        tileRadius: { value: 0.08, min: 0, max: 0.2, step: 0.01 },
        pmColor: { value: COMBAT_COLORS.PM_VIOLET },
        rangeColor: { value: COMBAT_COLORS.RANGE_ORANGE },
      }),
      'Log Tiles for AI': button((get) => {
        const tConfig = {
          tileDayA: get('Background Shader.Tile Colors.tileDayA'),
          tileDayB: get('Background Shader.Tile Colors.tileDayB'),
          tileSideDay: get('Background Shader.Tile Colors.tileSideDay'),
          tileSunA: get('Background Shader.Tile Colors.tileSunA'),
          tileSunB: get('Background Shader.Tile Colors.tileSunB'),
          tileSideSun: get('Background Shader.Tile Colors.tileSideSun'),
          tileNightA: get('Background Shader.Tile Colors.tileNightA'),
          tileNightB: get('Background Shader.Tile Colors.tileNightB'),
          tileSideNight: get('Background Shader.Tile Colors.tileSideNight'),
        };
        console.log('--- TILE CONFIG ---');
        console.log(JSON.stringify(tConfig, null, 2));
      }),
    });

    // Calculate current tile colors based on timeOfDay
    const currentTileColors = useMemo(() => {
      const c1 = new THREE.Color();
      const c2 = new THREE.Color();
      const cs = new THREE.Color();

      if (timeOfDay <= 1) {
        // Day to Sun
        const t = timeOfDay;
        c1.lerpColors(
          new THREE.Color(tileConfig.tileDayA),
          new THREE.Color(tileConfig.tileSunA),
          t,
        );
        c2.lerpColors(
          new THREE.Color(tileConfig.tileDayB),
          new THREE.Color(tileConfig.tileSunB),
          t,
        );
        cs.lerpColors(
          new THREE.Color(tileConfig.tileSideDay),
          new THREE.Color(tileConfig.tileSideSun),
          t,
        );
      } else {
        // Sun to Night
        const t = timeOfDay - 1;
        c1.lerpColors(
          new THREE.Color(tileConfig.tileSunA),
          new THREE.Color(tileConfig.tileNightA),
          t,
        );
        c2.lerpColors(
          new THREE.Color(tileConfig.tileSunB),
          new THREE.Color(tileConfig.tileNightB),
          t,
        );
        cs.lerpColors(
          new THREE.Color(tileConfig.tileSideSun),
          new THREE.Color(tileConfig.tileSideNight),
          t,
        );
      }

      return {
        checkerColorA: '#' + c1.getHexString(),
        checkerColorB: '#' + c2.getHexString(),
        sideColor: '#' + cs.getHexString(),
      };
    }, [timeOfDay, tileConfig]);

    const combatPlayers = useMemo(
      () => (mode === 'combat' && combatState ? Object.values(combatState.players) : []),
      [mode, combatState],
    );
    const combatTiles = combatState?.map?.tiles ?? [];
    const tileIndex = useMemo(() => buildTileIndex(combatTiles), [combatTiles]);
    const occupiedPositions = useMemo(
      () => combatPlayers.map((player) => player.position),
      [combatPlayers],
    );
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

      // 1. Raycast against players (still need this for tooltips/selection)
      const target = mapGroupRef.current || scene;
      const intersects = raycaster.intersectObjects([target], true);
      const playerIntersect = intersects.find(
        (intersection) => intersection.object.userData?.type === 'player-pawn',
      );

      if (playerIntersect) {
        setHoveredPlayerId(playerIntersect.object.userData.playerId);
      } else {
        setHoveredPlayerId(null);
      }

      // 2. Math-based raycast against the ground plane
      const planeIntersect = intersects.find(
        (intersection) => intersection.object.name === 'map-hit-plane',
      );

      if (!planeIntersect) {
        setHoveredTile(null);
        if (mode === 'farming') onTileHover?.(null);
        return;
      }

      // UV coordinates (0 to 1) are perfectly stable regardless of map rotation.
      // Plane UV.x is horizontal (0=left, 1=right).
      // Plane UV.y is vertical (1=top, 0=bottom because it's rotated -90 deg on X).
      if (!planeIntersect.uv) return;

      const gx = Math.min(activeMap.width - 1, Math.floor(planeIntersect.uv.x * activeMap.width));
      const gz = Math.min(
        activeMap.height - 1,
        Math.floor((1 - planeIntersect.uv.y) * activeMap.height),
      );

      if (gx < 0 || gx >= activeMap.width || gz < 0 || gz >= activeMap.height) {
        setHoveredTile(null);
        if (mode === 'farming') onTileHover?.(null);
        return;
      }

      const terrain = activeMap.grid[gz][gx] as TerrainType;

      setHoveredTile((previous) =>
        previous?.x === gx && previous?.y === gz ? previous : { x: gx, y: gz, terrain },
      );

      if (mode === 'farming') {
        onTileHover?.({ x: gx, y: gz, terrain });
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
            id: 'vfx-' + lastSpellCast.timestamp,
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
          id: 'dmg-' + lastDamageEvent.timestamp,
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
          id: 'heal-' + lastHealEvent.timestamp,
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

          if (next.x < 0 || next.x >= gameMap.width || next.y < 0 || next.y >= gameMap.height) {
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

    const filteredReachableTiles = useMemo(() => {
      if (mode !== 'combat' || selectedSpellId) return [];
      // On n'affiche la portée que si la souris survole le personnage local
      if (hoveredPlayerId !== currentUserId) return [];
      return reachableTiles;
    }, [mode, selectedSpellId, hoveredPlayerId, currentUserId, reachableTiles]);

    const combatPreviewPath = useMemo(() => {
      if (
        mode !== 'combat' ||
        !isMyTurn ||
        !currentPlayer ||
        !deferredHoveredTile ||
        !gameMap ||
        selectedSpellId
      ) {
        return [];
      }

      // Pas de preview si on survole sa propre case
      if (
        deferredHoveredTile.x === currentPlayer.position.x &&
        deferredHoveredTile.y === currentPlayer.position.y
      ) {
        return [];
      }

      let closestTile: { x: number; y: number } | null = null;
      let minDistance = Infinity;

      reachableTiles.forEach((tile) => {
        const distance =
          Math.abs(tile.x - deferredHoveredTile.x) + Math.abs(tile.y - deferredHoveredTile.y);
        if (distance < minDistance) {
          minDistance = distance;
          closestTile = tile;
        }
      });

      if (!closestTile) return [];

      // Pour la preview du trajet, on exclut le joueur local du set d'obstacles pour ne pas bloquer le point de départ
      const obstacles = new Set(occupiedPositionSet);
      if (currentUserId)
        obstacles.delete(toPositionKey(currentPlayer.position.x, currentPlayer.position.y));

      return findPath(gameMap, currentPlayer.position, closestTile, obstacles) ?? [];
    }, [
      currentPlayer,
      gameMap,
      deferredHoveredTile,
      isMyTurn,
      mode,
      reachableTiles,
      selectedSpellId,
    ]);

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
            (!spell.requiresLineOfSight ||
              hasLineOfSight(currentPlayer.position, target, combatState.map.tiles)) &&
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

            if (
              canMoveTo(
                target,
                currentPlayer.remainingPm,
                currentPlayer.position,
                combatState.map.tiles,
                occupiedPositions,
              )
            ) {
              response = await combatApi.playAction(sessionId, {
                type: CombatActionType.MOVE,
                targetX: x,
                targetY: y,
              });
            } else if (
              canJumpTo(
                target,
                currentPlayer.remainingPm,
                currentPlayer.position,
                combatState.map.tiles,
                occupiedPositions,
              )
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
            typeof (error as { response?: { data?: { message?: string } } }).response?.data
              ?.message === 'string'
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

    const handlePointerDown = useCallback(
      (e: ThreeEvent<PointerEvent>) => {
        // If we just finished a camera drag, ignore this click for map actions
        if (wasDraggingRef.current) return;

        // Manage right click for spell cancel
        if (e.button === 2) {
          rightClickStartTimeRef.current = Date.now();
          return;
        }

        if (e.button !== 0 || !e.uv || !activeMap) return;

        const gx = Math.min(activeMap.width - 1, Math.floor(e.uv.x * activeMap.width));
        const gz = Math.min(activeMap.height - 1, Math.floor((1 - e.uv.y) * activeMap.height));

        const terrain = activeMap.grid[gz][gx] as TerrainType;
        handleTileClickDispatcher(gx, gz, terrain);
      },
      [activeMap, handleTileClickDispatcher],
    );

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
          wasDraggingRef.current = false;
          dragDistanceRef.current = 0;
        }
      };

      const onPointerMoveWindow = (event: PointerEvent) => {
        if (!isDragging) return;

        const delta = event.clientX - previousX;
        dragDistanceRef.current += Math.abs(delta);

        // If moved more than 5 pixels, consider it a drag
        if (dragDistanceRef.current > 5) {
          wasDraggingRef.current = true;
        }

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
        onPointerUp={handlePointerUp}
        onContextMenu={(event) => event.nativeEvent.preventDefault()}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        <group ref={mapGroupRef} rotation={[0, mapRotation, 0]}>
          {mode === 'combat' && (
            <Suspense fallback={null}>
              <Castle position={[-1.07, 5.34, -0.94]} targetSize={14.0} rotation={[0, 0, 0]} />
            </Suspense>
          )}
          <TerrainLayer
            map={activeMap}
            onTileClick={handleTileClickDispatcher}
            checkerColorA={mode === 'combat' ? currentTileColors.checkerColorA : undefined}
            checkerColorB={mode === 'combat' ? currentTileColors.checkerColorB : undefined}
            sideColor={mode === 'combat' ? currentTileColors.sideColor : undefined}
            tileSize={mode === 'combat' ? tileConfig.tileSize : undefined}
            tileRadius={mode === 'combat' ? tileConfig.tileRadius : undefined}
          />

          {/* Interaction Plane - Must be visible=true for raycasting but transparent for user */}
          <mesh
            name="map-hit-plane"
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerMove={handlePointerMove}
            onClick={handlePointerDown}
            onPointerLeave={() => setHoveredTile(null)}
            visible={true}
          >
            <planeGeometry args={[activeMap.width, activeMap.height]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          <HoverLayer hoveredTile={hoveredTile} map={activeMap} />

          <UnifiedMapOverlayLayer
            mode={mode}
            isMyTurn={isMyTurn}
            selectedSpellId={selectedSpellId}
            reachableTiles={filteredReachableTiles}
            spellRangeTiles={spellRangeTiles}
            combatPreviewPath={combatPreviewPath}
            map={activeMap}
            currentUserId={currentUserId}
            playerPaths={playerPaths}
            pmColor={tileConfig.pmColor}
            rangeColor={tileConfig.rangeColor}
            tileSize={tileConfig.tileSize}
            hoveredTile={hoveredTile}
          />

          <PlayersLayer
            mode={mode}
            mapWidth={activeMap.width}
            playerPosition={playerPosition}
            movePath={movePath}
            onPathComplete={onPathComplete}
            farmingPlayerName={user?.username ?? ''}
            farmingPlayerSkin={user?.skin}
            combatPlayers={combatPlayers}
            visualPositions={visualPositions}
            playerPaths={playerPaths}
            jumpingPlayers={jumpingPlayers}
            setPawnRef={setPawnRef}
            onCombatPathComplete={handleCombatPathComplete}
            onTileReached={onTileReached}
          />

          <TransientEffectsLayer
            vfx={vfx}
            popups={popups}
            onRemoveVfx={removeVfx}
            onRemovePopup={removePopup}
          />
        </group>
      </group>
    );
  },
);

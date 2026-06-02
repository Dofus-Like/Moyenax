import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { GameMap, PathNode } from '@game/shared-types';
import { TerrainType } from '@game/shared-types';

import type { PlayerPawnHandle } from '../game/ResourceMap/PlayerPawn';
import { useAuthStore } from '../store/auth.store';
import {
  HoverLayer,
  PlayersLayer,
  TerrainLayer,
} from '../game/UnifiedMap/UnifiedMapLayers';

interface HitPlaneProps {
  map: GameMap;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerLeave: () => void;
}

const HitPlane = React.memo(
  ({ map, onPointerMove, onPointerDown, onPointerLeave }: HitPlaneProps) => (
    <mesh
      name="map-hit-plane"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerMove={onPointerMove}
      onClick={onPointerDown}
      onPointerLeave={onPointerLeave}
      visible={true}
    >
      <planeGeometry args={[map.width, map.height]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  ),
);

interface FarmingMapSceneProps {
  map: GameMap;
  harvestedTiles: Set<string>;
  playerPosition?: PathNode;
  movePath?: PathNode[] | null;
  onPathComplete?: () => void;
  onTileClick?: (x: number, y: number, terrain: TerrainType) => void;
  onTileHover?: (info: { x: number; y: number; terrain: TerrainType } | null) => void;
  isMoving?: boolean;
  onTileReached?: (node: PathNode) => void;
  onSceneReady?: () => void;
  playerPa?: number;
  playerPm?: number;
}

export const FarmingMapScene = React.memo(
  ({
    map,
    harvestedTiles,
    playerPosition,
    movePath,
    onPathComplete,
    onTileClick,
    onTileHover,
    isMoving = false,
    onTileReached,
    onSceneReady,
    playerPa,
    playerPm,
  }: FarmingMapSceneProps) => {
    const user = useAuthStore((state) => state.player);

    const visibleMap = useMemo(() => {
      if (!map || !harvestedTiles.size) return map;
      const grid = map.grid.map((row) => [...row]);
      for (const key of harvestedTiles) {
        const [x, y] = key.split(',').map(Number);
        if (grid[y] && grid[y][x] !== undefined) {
          grid[y][x] = TerrainType.GROUND;
        }
      }
      return { ...map, grid };
    }, [map, harvestedTiles]);

    const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
    const deferredHoveredTile = React.useDeferredValue(hoveredTile);

    const mapGroupRef = useRef<THREE.Group>(null);
    const hoveredTileRef = useRef<{ x: number; y: number } | null>(null);
    const lastFarmingHoverUvRef = useRef<{ x: number; y: number } | null>(null);
    const hasReportedSceneReadyRef = useRef(false);
    const pawnRefs = useRef(new Map<string, PlayerPawnHandle>());
    const wasDraggingRef = useRef(false);
    const dragDistanceRef = useRef(0);
    const isPointerPressedRef = useRef(false);
    const isDraggingRef = useRef(false);

    useEffect(() => {
      hasReportedSceneReadyRef.current = false;
    }, [map]);

    useFrame(() => {
      if (!map || hasReportedSceneReadyRef.current) return;
      hasReportedSceneReadyRef.current = true;
      onSceneReady?.();
    });

    const clearHoveredTile = useCallback(() => {
      if (!hoveredTileRef.current) return;
      hoveredTileRef.current = null;
      setHoveredTile(null);
      onTileHover?.(null);
    }, [onTileHover]);

    const updateHoveredTile = useCallback(
      (uv: { x: number; y: number }) => {
        if (!map) return;
        lastFarmingHoverUvRef.current = uv;

        if (isPointerPressedRef.current) return;

        const gx = Math.min(map.width - 1, Math.floor(uv.x * map.width));
        const gz = Math.min(map.height - 1, Math.floor((1 - uv.y) * map.height));

        if (gx < 0 || gx >= map.width || gz < 0 || gz >= map.height) {
          clearHoveredTile();
          return;
        }

        const previous = hoveredTileRef.current;
        if (previous?.x === gx && previous.y === gz) return;

        const terrain = (visibleMap ?? map).grid[gz][gx] as TerrainType;
        hoveredTileRef.current = { x: gx, y: gz };
        setHoveredTile({ x: gx, y: gz });
        onTileHover?.({ x: gx, y: gz, terrain });
      },
      [map, visibleMap, clearHoveredTile, onTileHover],
    );

    const handlePointerMove = useCallback(
      (event: ThreeEvent<PointerEvent>) => {
        if (event.uv) {
          updateHoveredTile(event.uv);
        } else {
          lastFarmingHoverUvRef.current = null;
          clearHoveredTile();
        }
      },
      [clearHoveredTile, updateHoveredTile],
    );

    const handlePointerDown = useCallback(
      (e: ThreeEvent<PointerEvent>) => {
        if (wasDraggingRef.current || e.button !== 0 || !e.uv || !map) return;

        const gx = Math.min(map.width - 1, Math.floor(e.uv.x * map.width));
        const gz = Math.min(map.height - 1, Math.floor((1 - e.uv.y) * map.height));
        const terrain = (visibleMap ?? map).grid[gz][gx] as TerrainType;
        onTileClick?.(gx, gz, terrain);
      },
      [map, visibleMap, onTileClick],
    );

    const handlePointerUp = useCallback((_event: ThreeEvent<PointerEvent>) => {
      // no-op for farming
    }, []);

    const handleMapPointerLeave = useCallback(() => {
      clearHoveredTile();
    }, [clearHoveredTile]);

    const updateHoveredTileRef = useRef(updateHoveredTile);

    useEffect(() => {
      updateHoveredTileRef.current = updateHoveredTile;
    }, [updateHoveredTile]);

    useEffect(() => {
      const onPointerDown = (event: PointerEvent): void => {
        if (event.button === 0) {
          isPointerPressedRef.current = true;
          isDraggingRef.current = true;
          wasDraggingRef.current = false;
          dragDistanceRef.current = 0;
        }
      };

      const onPointerMove = (event: PointerEvent): void => {
        if (!isDraggingRef.current) return;

        dragDistanceRef.current += Math.abs(event.movementX || 0);

        if (dragDistanceRef.current > 5) {
          wasDraggingRef.current = true;
        }

        if (mapGroupRef.current && wasDraggingRef.current) {
          mapGroupRef.current.rotation.y += (event.movementX || 0) * 0.005;
        }
      };

      const onPointerUp = (): void => {
        isPointerPressedRef.current = false;
        isDraggingRef.current = false;
        if (lastFarmingHoverUvRef.current) {
          updateHoveredTileRef.current(lastFarmingHoverUvRef.current);
        }
      };

      const onPointerCancel = (): void => {
        isPointerPressedRef.current = false;
        isDraggingRef.current = false;
      };

      window.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);

      return (): void => {
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
      };
    }, []);

    const setPawnRef = useCallback((_playerId: string, handle: PlayerPawnHandle | null) => {
      if (handle) {
        pawnRefs.current.set('player', handle);
      } else {
        pawnRefs.current.delete('player');
      }
    }, []);

    if (!map) return null;

    return (
      <group
        onPointerUp={handlePointerUp}
        onContextMenu={(event) => event.nativeEvent.preventDefault()}
      >
        <group ref={mapGroupRef}>
          <TerrainLayer map={visibleMap} tacticsMode={false} checkerColorA="#434F34" checkerColorB="#434F34" tileSize={1} tileRadius={0} />

          <HitPlane
            map={visibleMap}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerLeave={handleMapPointerLeave}
          />

          <HoverLayer hoveredTile={deferredHoveredTile} map={visibleMap} />

          <PlayersLayer
            mode="farming"
            mapWidth={map.width}
            playerPosition={playerPosition}
            movePath={movePath}
            onPathComplete={onPathComplete}
            farmingPlayerName={user?.username ?? ''}
            farmingPlayerSkin={user?.skin}
            farmingPlayerPa={playerPa}
            farmingPlayerPm={playerPm}
            combatPlayers={[]}
            visualPositions={{}}
            playerPaths={{}}
            jumpingPlayers={{}}
            setPawnRef={setPawnRef}
            onCombatPathComplete={() => {}}
            onTileReached={onTileReached}
          />
        </group>
      </group>
    );
  },
);

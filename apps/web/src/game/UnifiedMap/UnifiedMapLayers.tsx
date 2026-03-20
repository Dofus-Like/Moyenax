import React, { Suspense, useMemo } from 'react';
import { CombatPlayer, GameMap, PathNode, TerrainType } from '@game/shared-types';
import { TerrainTile, TerrainTileProps } from '../ResourceMap/TerrainTile';
import { TileHoverEffect } from '../ResourceMap/TileHoverEffect';
import { PlayerPawn, PlayerPawnHandle } from '../ResourceMap/PlayerPawn';
import { PathPreview } from '../ResourceMap/PathPreview';
import { CombatHighlightsLayer } from './CombatHighlights';
import { SpellVFX } from './overlays/SpellVFX';
import { DamagePopup } from './overlays/DamagePopup';

interface TerrainLayerProps {
  map: GameMap;
  onTileClick?: (x: number, y: number, terrain: TerrainType) => void;
}

export const TerrainLayer = React.memo(({ map, onTileClick }: TerrainLayerProps) => {
  const tiles = useMemo(() => {
    const result: React.ReactElement[] = [];

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.grid[y][x] as TerrainType;
        const tileProps: TerrainTileProps = {
          x,
          y,
          terrain,
          gridSize: map.width,
          onTileClick,
        };
        result.push(<TerrainTile key={`${x}-${y}`} {...tileProps} />);
      }
    }

    return result;
  }, [map, onTileClick]);

  return <>{tiles}</>;
});

interface HoverLayerProps {
  hoveredTile: { x: number; y: number } | null;
  map: GameMap;
}

export const HoverLayer = React.memo(({ hoveredTile, map }: HoverLayerProps) => {
  if (!hoveredTile) return null;

  return (
    <TileHoverEffect
      x={hoveredTile.x}
      y={hoveredTile.y}
      terrain={map.grid[hoveredTile.y][hoveredTile.x] as TerrainType}
      gridSize={map.width}
    />
  );
});

interface OverlayLayerProps {
  mode: 'combat' | 'farming';
  isMyTurn: boolean;
  selectedSpellId: string | null;
  reachableTiles: { x: number; y: number }[];
  spellRangeTiles: { x: number; y: number }[];
  combatPreviewPath: PathNode[];
  previewPath?: PathNode[];
  isMoving: boolean;
  map: GameMap;
  currentUserId?: string;
  playerPaths: Record<string, PathNode[]>;
}

export const UnifiedMapOverlayLayer = React.memo(
  ({
    mode,
    isMyTurn,
    selectedSpellId,
    reachableTiles,
    spellRangeTiles,
    combatPreviewPath,
    previewPath,
    isMoving,
    map,
    currentUserId,
    playerPaths,
  }: OverlayLayerProps) => {
    return (
      <Suspense fallback={null}>
        {mode === 'combat' && isMyTurn && (
          <CombatHighlightsLayer
            reachableTiles={selectedSpellId ? [] : reachableTiles}
            spellRangeTiles={spellRangeTiles}
            pathTarget={combatPreviewPath.length > 0 ? combatPreviewPath[combatPreviewPath.length - 1] : null}
            gridSize={map.width}
          />
        )}

        {mode === 'farming' && previewPath && !isMoving && (
          <PathPreview path={previewPath} gridSize={map.width} />
        )}

        {mode === 'combat' && isMyTurn && currentUserId && !playerPaths[currentUserId] && (
          <PathPreview path={combatPreviewPath} gridSize={map.width} />
        )}
      </Suspense>
    );
  },
);

interface PlayersLayerProps {
  mode: 'combat' | 'farming';
  mapWidth: number;
  playerPosition?: PathNode;
  movePath?: PathNode[] | null;
  onPathComplete?: () => void;
  farmingPlayerName: string;
  combatPlayers: CombatPlayer[];
  visualPositions: Record<string, PathNode>;
  playerPaths: Record<string, PathNode[]>;
  jumpingPlayers: Record<string, boolean>;
  setPawnRef: (playerId: string, handle: PlayerPawnHandle | null) => void;
  onCombatPathComplete: (playerId: string) => void;
}

export const PlayersLayer = React.memo(
  ({
    mode,
    mapWidth,
    playerPosition,
    movePath,
    onPathComplete,
    farmingPlayerName,
    combatPlayers,
    visualPositions,
    playerPaths,
    jumpingPlayers,
    setPawnRef,
    onCombatPathComplete,
  }: PlayersLayerProps) => {
    if (mode === 'farming' && playerPosition) {
      return (
        <PlayerPawn
          gridPosition={playerPosition}
          gridSize={mapWidth}
          path={movePath || null}
          onPathComplete={onPathComplete ?? (() => undefined)}
          playerData={{ username: farmingPlayerName }}
        />
      );
    }

    if (mode !== 'combat') return null;

    return (
      <>
        {combatPlayers.map((player) => {
          const position = visualPositions[player.playerId] || player.position;
          const opponent = combatPlayers.find((candidate) => candidate.playerId !== player.playerId);
          const opponentPosition = opponent
            ? visualPositions[opponent.playerId] || opponent.position
            : null;

          return (
            <PlayerPawn
              key={player.playerId}
              ref={(handle) => setPawnRef(player.playerId, handle)}
              gridPosition={position}
              gridSize={mapWidth}
              path={playerPaths[player.playerId] || null}
              playerData={player}
              lookAtPosition={opponentPosition}
              isJumping={!!jumpingPlayers[player.playerId]}
              onPathComplete={() => onCombatPathComplete(player.playerId)}
            />
          );
        })}
      </>
    );
  },
);

interface TransientEffectsLayerProps {
  vfx: { id: string; type: string; from: { x: number; y: number }; to: { x: number; y: number } }[];
  popups: { id: string; pos: [number, number, number]; val: number }[];
  onRemoveVfx: (id: string) => void;
  onRemovePopup: (id: string) => void;
}

export const TransientEffectsLayer = React.memo(
  ({ vfx, popups, onRemoveVfx, onRemovePopup }: TransientEffectsLayerProps) => {
    return (
      <Suspense fallback={null}>
        {vfx.map((effect) => (
          <Suspense key={effect.id} fallback={null}>
            <SpellVFX
              type={effect.type}
              from={effect.from}
              to={effect.to}
              onComplete={() => onRemoveVfx(effect.id)}
            />
          </Suspense>
        ))}
        {popups.map((popup) => (
          <Suspense key={popup.id} fallback={null}>
            <DamagePopup
              position={popup.pos}
              value={popup.val}
              onComplete={() => onRemovePopup(popup.id)}
            />
          </Suspense>
        ))}
      </Suspense>
    );
  },
);

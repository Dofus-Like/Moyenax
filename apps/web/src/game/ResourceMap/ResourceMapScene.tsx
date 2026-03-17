import React from 'react';
import { TerrainType, GameMap, PathNode } from '@game/shared-types';
import { TerrainTile, TileHoverInfo } from './TerrainTile';
import { PlayerPawn } from './PlayerPawn';
import { PathPreview } from './PathPreview';

interface ResourceMapSceneProps {
  map: GameMap;
  onTileClick?: (x: number, y: number, terrain: TerrainType) => void;
  onTileHover?: (info: TileHoverInfo | null) => void;
  playerPosition: PathNode;
  movePath: PathNode[] | null;
  previewPath: PathNode[];
  onPathComplete: () => void;
}

export function ResourceMapScene({
  map,
  onTileClick,
  onTileHover,
  playerPosition,
  movePath,
  previewPath,
  onPathComplete,
}: ResourceMapSceneProps) {
  const tiles: React.ReactElement[] = [];

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const terrain = map.grid[y][x] as TerrainType;
      tiles.push(
        <TerrainTile
          key={`${x}-${y}`}
          x={x}
          y={y}
          terrain={terrain}
          gridSize={map.width}
          onTileClick={onTileClick}
          onTileHover={onTileHover}
        />,
      );
    }
  }

  return (
    <group>
      {tiles}
      <PathPreview path={previewPath} gridSize={map.width} />
      <PlayerPawn
        gridPosition={playerPosition}
        gridSize={map.width}
        path={movePath}
        onPathComplete={onPathComplete}
      />
    </group>
  );
}

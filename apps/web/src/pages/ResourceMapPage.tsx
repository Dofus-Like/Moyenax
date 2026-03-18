import React, { useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls } from '@react-three/drei';
import { useQuery } from '@tanstack/react-query';
import { ResourceMapScene } from '../game/ResourceMap/ResourceMapScene';
import { TileHoverInfo } from '../game/ResourceMap/TerrainTile';
import { mapApi } from '../api/map.api';
import {
  TerrainType,
  TERRAIN_PROPERTIES,
  TERRAIN_LABELS,
  CombatTerrainType,
  SEED_CONFIGS,
  SeedId,
  PathNode,
  findPath,
} from '@game/shared-types';
import { useNavigate } from 'react-router-dom';
import './ResourceMapPage.css';

const COMBAT_TYPE_LABELS: Record<CombatTerrainType, string> = {
  [CombatTerrainType.FLAT]: 'PLAT',
  [CombatTerrainType.WALL]: 'MUR',
  [CombatTerrainType.HOLE]: 'TROU',
};

function buildTooltipLines(terrain: TerrainType): string[] {
  const props = TERRAIN_PROPERTIES[terrain];
  const lines: string[] = [];

  lines.push(`Type combat : ${COMBAT_TYPE_LABELS[props.combatType]}`);

  if (props.harvestable && props.resourceName) {
    lines.push(`Récolter : ${props.resourceName}`);
  }
  if (props.traversable) {
    lines.push('Traversable');
  } else {
    lines.push('Non traversable');
  }
  if (props.jumpable) {
    lines.push('Peut sauter par-dessus (+1 PM)');
  }
  if (props.blockLineOfSight) {
    lines.push('Bloque la ligne de vue');
  }
  if (props.family) {
    lines.push(`Famille : ${props.family}`);
  }
  return lines;
}

function findSpawnPosition(grid: TerrainType[][]): PathNode {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (TERRAIN_PROPERTIES[grid[y][x]].traversable) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}

export function ResourceMapPage() {
  const navigate = useNavigate();
  const [hoverInfo, setHoverInfo] = useState<TileHoverInfo | null>(null);
  const [playerPos, setPlayerPos] = useState<PathNode | null>(null);
  const [movePath, setMovePath] = useState<PathNode[] | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const {
    data: map,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['map', 'session'],
    queryFn: mapApi.generateNew,
    staleTime: Infinity,
    refetchOnMount: 'always',
  });

  const seedConfig = useMemo(() => {
    if (!map) return null;
    return SEED_CONFIGS[map.seedId as SeedId] ?? null;
  }, [map]);

  const currentPlayerPos = useMemo(() => {
    if (playerPos) return playerPos;
    if (map) return findSpawnPosition(map.grid);
    return { x: 0, y: 0 };
  }, [playerPos, map]);

  const previewPath = useMemo(() => {
    if (!map || !hoverInfo || isMoving) return [];
    const target = { x: hoverInfo.x, y: hoverInfo.y };
    if (target.x === currentPlayerPos.x && target.y === currentPlayerPos.y) return [];
    if (!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable) return [];
    return findPath(map, currentPlayerPos, target) ?? [];
  }, [map, hoverInfo, currentPlayerPos, isMoving]);

  const handleTileClick = useCallback(
    (x: number, y: number, terrain: TerrainType) => {
      if (!map || isMoving) return;
      if (!TERRAIN_PROPERTIES[terrain].traversable) return;
      if (x === currentPlayerPos.x && y === currentPlayerPos.y) return;

      const path = findPath(map, currentPlayerPos, { x, y });
      if (path && path.length > 0) {
        setMovePath(path);
        setIsMoving(true);
      }
    },
    [map, isMoving, currentPlayerPos],
  );

  const handlePathComplete = useCallback(() => {
    if (movePath && movePath.length > 0) {
      const last = movePath[movePath.length - 1];
      setPlayerPos({ x: last.x, y: last.y });
    }
    setMovePath(null);
    setIsMoving(false);
  }, [movePath]);

  const handleTileHover = useCallback((info: TileHoverInfo | null) => {
    setHoverInfo(info);
  }, []);

  return (
    <div className="resource-map-container">
      <header className="resource-map-header">
        <button className="back-button" onClick={() => navigate('/')}>
          Retour
        </button>
        <h2>Carte des Ressources</h2>
        {seedConfig && (
          <div className="seed-badge">
            {seedConfig.label} — {seedConfig.dominantBuild}
          </div>
        )}
        <div className="map-legend">
          <span className="legend-item legend-ground">Sol</span>
          <span className="legend-item legend-iron">Fer</span>
          <span className="legend-item legend-leather">Cuir</span>
          <span className="legend-item legend-crystal">Cristal</span>
          <span className="legend-item legend-fabric">Étoffe</span>
          <span className="legend-item legend-wood">Bois</span>
          <span className="legend-item legend-herb">Herbe</span>
          <span className="legend-item legend-gold">Or</span>
        </div>
      </header>

      <div className="resource-map-canvas">
        {isLoading && <div className="map-loading">Chargement de la carte...</div>}
        {error && <div className="map-error">Erreur de chargement</div>}
        {map && (
          <Canvas shadows>
            <OrthographicCamera
              makeDefault
              position={[15, 20, 15]}
              zoom={30}
              near={0.1}
              far={100}
            />
            <OrbitControls
              target={[0, 0, 0]}
              enableRotate={true}
              enablePan={true}
              minZoom={15}
              maxZoom={80}
              maxPolarAngle={Math.PI / 2.2}
              minPolarAngle={0.2}
            />
            <ambientLight intensity={0.5} />
            <hemisphereLight args={['#87CEEB', '#654321', 0.6]} />
            <directionalLight
              position={[10, 15, 10]}
              intensity={1.2}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-far={50}
              shadow-camera-left={-20}
              shadow-camera-right={20}
              shadow-camera-top={20}
              shadow-camera-bottom={-20}
            />
            <color attach="background" args={['#0a0e17']} />
            <ResourceMapScene
              map={map}
              onTileClick={handleTileClick}
              onTileHover={handleTileHover}
              playerPosition={currentPlayerPos}
              movePath={movePath}
              previewPath={previewPath}
              onPathComplete={handlePathComplete}
            />
          </Canvas>
        )}

        <div className="tile-info-panel">
          {hoverInfo ? (
            <>
              <div className="tile-info-title">
                {TERRAIN_LABELS[hoverInfo.terrain]}
              </div>
              <div className="tile-info-coords">
                Case ({hoverInfo.x}, {hoverInfo.y})
              </div>
              <ul className="tile-info-props">
                {buildTooltipLines(hoverInfo.terrain).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              {previewPath.length > 0 && (
                <div className="tile-info-distance">
                  Distance : {previewPath.length} case{previewPath.length > 1 ? 's' : ''}
                </div>
              )}
              {!TERRAIN_PROPERTIES[hoverInfo.terrain].traversable && (
                <div className="tile-info-blocked">Inaccessible</div>
              )}
            </>
          ) : (
            <div className="tile-info-empty">Survolez une case</div>
          )}
        </div>
      </div>
    </div>
  );
}

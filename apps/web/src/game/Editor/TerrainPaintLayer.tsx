import { type ThreeEvent } from '@react-three/fiber';
import { type ReactElement, Suspense, useCallback, useMemo, useRef } from 'react';

import { useEditorStore } from '../../store/editor.store';
import { InstancedTerrain } from '../UnifiedMap/InstancedTerrain';

import { terrainToMap, worldToCell } from './terrainGrid';

export function TerrainPaintLayer(): ReactElement {
  const terrain = useEditorStore((s) => s.template.terrain);
  const map = useMemo(() => terrainToMap(terrain), [terrain]);
  const painting = useRef(false);

  const paintAt = useCallback(
    (point: { x: number; z: number }): void => {
      const cell = worldToCell(point.x, point.z, map.width, map.height);
      if (cell) useEditorStore.getState().paintTile(cell[0], cell[1]);
    },
    [map.width, map.height],
  );

  const onDown = useCallback(
    (event: ThreeEvent<PointerEvent>): void => {
      event.stopPropagation();
      painting.current = true;
      useEditorStore.getState().beginTerrainStroke();
      paintAt(event.point);
    },
    [paintAt],
  );

  const onMove = useCallback(
    (event: ThreeEvent<PointerEvent>): void => {
      if (painting.current) paintAt(event.point);
    },
    [paintAt],
  );

  const stop = useCallback((): void => {
    painting.current = false;
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <InstancedTerrain map={map} />
      </Suspense>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerLeave={stop}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

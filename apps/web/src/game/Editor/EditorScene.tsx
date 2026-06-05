import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { type ReactElement, useEffect, useRef } from 'react';
import type { Object3D } from 'three';

import { useEditorStore } from '../../store/editor.store';

import { DropTarget } from './DropTarget';
import { EditorGround } from './EditorGround';
import { EditorSky } from './EditorSky';
import { EditorTransformGizmo } from './EditorTransformGizmo';
import { PlacedProps } from './PlacedProps';
import { TerrainPaintLayer } from './TerrainPaintLayer';

interface ResettableControls {
  reset?: () => void;
}

// Recenters the orbit camera when the "F" shortcut bumps resetViewSignal.
function CameraResetter(): null {
  const signal = useEditorStore((s) => s.resetViewSignal);
  const controls = useThree((s) => s.controls) as ResettableControls | null;
  useEffect(() => {
    if (signal > 0) controls?.reset?.();
  }, [signal, controls]);
  return null;
}

export function EditorScene(): ReactElement {
  const objects = useRef<Map<string, Object3D>>(new Map());
  const terrainMode = useEditorStore((s) => s.editTool === 'terrain');

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [10, 10, 10], fov: 45 }}
      gl={{ antialias: true }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <EditorSky />
      <Grid
        args={[GRID_EXTENT, GRID_EXTENT]}
        cellSize={1}
        cellColor="#3a4254"
        sectionColor="#5b6b86"
        fadeDistance={60}
        infiniteGrid
        position={[0, 0.01, 0]}
      />
      <PlacedProps objects={objects} />
      {terrainMode ? (
        <TerrainPaintLayer />
      ) : (
        <>
          <EditorGround objects={objects} />
          <DropTarget objects={objects} />
          <EditorTransformGizmo objects={objects} />
        </>
      )}
      <OrbitControls makeDefault enableDamping enableRotate={!terrainMode} />
      <CameraResetter />
    </Canvas>
  );
}

const GRID_EXTENT = 60;

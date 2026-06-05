import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { type ReactElement, Suspense, useMemo } from 'react';

import { useEditorStore } from '../../store/editor.store';
import { InstancedFoliage } from '../UnifiedMap/InstancedFoliage';
import { InstancedTerrain } from '../UnifiedMap/InstancedTerrain';

import { EditorSky } from './EditorSky';
import { StaticProps } from './StaticProps';
import { terrainToMap } from './terrainGrid';

export function EditorPlayScene(): ReactElement {
  const terrain = useEditorStore((s) => s.template.terrain);
  const map = useMemo(() => terrainToMap(terrain), [terrain]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [10, 10, 10], fov: 45 }}
      gl={{ antialias: true }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <EditorSky />
      <Suspense fallback={null}>
        <InstancedTerrain map={map} />
        <InstancedFoliage map={map} />
      </Suspense>
      <StaticProps />
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  );
}

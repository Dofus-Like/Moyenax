import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { type ReactElement, Suspense, useMemo } from 'react';

import { generateMap } from '@game/game-engine';

import { useEditorStore } from '../../store/editor.store';
import { InstancedFoliage } from '../UnifiedMap/InstancedFoliage';
import { InstancedTerrain } from '../UnifiedMap/InstancedTerrain';

import { EditorSky } from './EditorSky';
import { StaticProps } from './StaticProps';

// Stable numeric seed from the seedId string → same resources every render for a given seed.
function seedHash(seedId: string): number {
  let hash = 0;
  for (let i = 0; i < seedId.length; i++) hash = (hash * 31 + seedId.charCodeAt(i)) % 1_000_000;
  return hash;
}

export function EditorPlayScene(): ReactElement {
  const seedId = useEditorStore((s) => s.template.terrain.seedId);
  const map = useMemo(() => generateMap(seedId, seedHash(seedId)), [seedId]);

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

import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { Box3, type Group } from 'three';

import { useHubGround } from './HubGround';
import { HUB_GLB_URL, MAP_SCALE } from './constants';

useGLTF.preload(HUB_GLB_URL);

export function HubMap(): ReactElement {
  const { scene } = useGLTF(HUB_GLB_URL);
  const { registerHub } = useHubGround();
  const wrapperRef = useRef<Group>(null);

  const cloned = useMemo(() => scene.clone(true), [scene]);

  const yOffset = useMemo(() => {
    const box = new Box3().setFromObject(cloned);
    return -box.max.y * MAP_SCALE;
  }, [cloned]);

  useEffect(() => {
    cloned.traverse((object): void => {
      if ('isMesh' in object && object.isMesh) {
        const mesh = object as { castShadow: boolean; receiveShadow: boolean };
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [cloned]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.updateMatrixWorld(true);
    registerHub(wrapper);
    return (): void => registerHub(null);
  }, [cloned, registerHub, yOffset]);

  return (
    <group ref={wrapperRef}>
      <primitive object={cloned} scale={MAP_SCALE} position={[0, yOffset, 0]} />
    </group>
  );
}

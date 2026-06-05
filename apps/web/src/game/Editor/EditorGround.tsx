import { type ThreeEvent } from '@react-three/fiber';
import { type ReactElement, useCallback } from 'react';

import type { Vec3 } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';

import { type ObjectsRef } from './PlacedProps';
import { findFreePosition } from './collision';

const GROUND_SIZE = 200;

interface EditorGroundProps {
  objects: ObjectsRef;
}

export function EditorGround({ objects }: EditorGroundProps): ReactElement {
  const select = useEditorStore((s) => s.select);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<MouseEvent>): void => {
      const { placingModelKey, template, addProp } = useEditorStore.getState();
      if (placingModelKey) {
        const point: Vec3 = [event.point.x, 0, event.point.z];
        addProp(placingModelKey, findFreePosition(point, objects, template.props));
        return;
      }
      select(null);
    },
    [objects, select],
  );

  return (
    <mesh
      name="editor-ground"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial color="#1b2230" roughness={1} />
    </mesh>
  );
}

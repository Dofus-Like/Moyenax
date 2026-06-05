import { type ThreeEvent } from '@react-three/fiber';
import { type MutableRefObject, type ReactElement, Suspense, useCallback } from 'react';
import type { Group, Object3D } from 'three';

import type { PlacedProp } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';

import { PropModel } from './PropModel';

export type ObjectsRef = MutableRefObject<Map<string, Object3D>>;

interface PlacedPropsProps {
  objects: ObjectsRef;
}

export function PlacedProps({ objects }: PlacedPropsProps): ReactElement {
  const props = useEditorStore((s) => s.template.props);
  return (
    <>
      {props.map((prop) => (
        <PlacedPropItem key={prop.id} prop={prop} objects={objects} />
      ))}
    </>
  );
}

interface PlacedPropItemProps {
  prop: PlacedProp;
  objects: ObjectsRef;
}

function PlacedPropItem({ prop, objects }: PlacedPropItemProps): ReactElement {
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);

  const setRef = useCallback(
    (node: Group | null): void => {
      if (node) objects.current.set(prop.id, node);
      else objects.current.delete(prop.id);
    },
    [objects, prop.id],
  );

  const handleSelect = useCallback(
    (event: ThreeEvent<MouseEvent>): void => {
      event.stopPropagation();
      select(prop.id);
    },
    [select, prop.id],
  );

  return (
    <group ref={setRef} position={prop.position} rotation={prop.rotation} scale={prop.scale}>
      <Suspense fallback={null}>
        <PropModel
          modelKey={prop.modelKey}
          selected={selectedId === prop.id}
          collides={prop.collides}
          onSelect={handleSelect}
        />
      </Suspense>
    </group>
  );
}

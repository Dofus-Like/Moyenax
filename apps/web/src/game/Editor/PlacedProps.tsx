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
      {props
        .filter((prop) => !prop.hidden)
        .map((prop) => (
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
  const selected = useEditorStore((s) => s.selectedIds.includes(prop.id));

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
      if (prop.locked) return;
      const store = useEditorStore.getState();
      if (event.nativeEvent.shiftKey) store.toggleSelect(prop.id);
      else store.select(prop.id);
    },
    [prop.id, prop.locked],
  );

  return (
    <group ref={setRef} position={prop.position} rotation={prop.rotation} scale={prop.scale}>
      <Suspense fallback={null}>
        <PropModel
          modelKey={prop.modelKey}
          selected={selected}
          collides={prop.collides}
          onSelect={handleSelect}
        />
      </Suspense>
    </group>
  );
}

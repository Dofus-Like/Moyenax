import { type ReactElement, Suspense } from 'react';

import { useEditorStore } from '../../store/editor.store';

import { PropModel } from './PropModel';

function noop(): void {
  // Read-only in play mode: props are decor, not selectable.
}

export function StaticProps(): ReactElement {
  const props = useEditorStore((s) => s.template.props);
  return (
    <>
      {props.map((prop) => (
        <group key={prop.id} position={prop.position} rotation={prop.rotation} scale={prop.scale}>
          <Suspense fallback={null}>
            <PropModel
              modelKey={prop.modelKey}
              selected={false}
              collides={prop.collides}
              onSelect={noop}
            />
          </Suspense>
        </group>
      ))}
    </>
  );
}

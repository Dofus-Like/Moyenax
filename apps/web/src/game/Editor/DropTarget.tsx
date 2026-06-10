import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';

import { useEditorStore } from '../../store/editor.store';

import { type ObjectsRef } from './PlacedProps';
import { findFreePosition } from './collision';

export const DROP_MIME = 'application/x-model-key';

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

interface DropTargetProps {
  objects: ObjectsRef;
}

// Bridges HTML drag-and-drop (palette → canvas) into a 3D ground raycast using the
// live R3F camera, then places the dragged model at the drop point (nudged off colliders).
export function DropTarget({ objects }: DropTargetProps): null {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const hit = new Vector3();

    const onDragOver = (event: DragEvent): void => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      const key = event.dataTransfer?.getData(DROP_MIME);
      if (!key) return;
      const rect = el.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(GROUND_PLANE, hit)) {
        const { template, addProp } = useEditorStore.getState();
        addProp(key, findFreePosition([hit.x, 0, hit.z], objects, template.props));
      }
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    return (): void => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
    };
  }, [gl, camera, objects]);

  return null;
}

import { TransformControls } from '@react-three/drei';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Euler, type Object3D, Vector3 } from 'three';

import type { Vec3 } from '@game/shared-types';

import { type GizmoMode, type PropPatch, snapVec, useEditorStore } from '../../store/editor.store';

import { type ObjectsRef } from './PlacedProps';
import { type Obstacle, collectObstacles, hasNewCollision, worldModelBox } from './collision';

interface EditorTransformGizmoProps {
  objects: ObjectsRef;
}

interface Snapshot {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
}

interface GizmoDrag {
  onDragStart: () => void;
  onObjectChange: () => void;
}

function uniformizeScale(obj: Object3D, startScale: number): void {
  const ratios = [obj.scale.x / startScale, obj.scale.y / startScale, obj.scale.z / startScale];
  const ratio = ratios.reduce(
    (best, cur) => (Math.abs(cur - 1) > Math.abs(best - 1) ? cur : best),
    1,
  );
  obj.scale.setScalar(Math.max(0.05, startScale * ratio));
}

// Drives a transform drag: uniform scaling, group translation (move the whole
// selection together), and single-object collision blocking.
function useGizmoDrag(
  target: Object3D | null,
  gizmoMode: GizmoMode,
  objects: ObjectsRef,
): GizmoDrag {
  const obstacles = useRef<Obstacle[]>([]);
  const others = useRef<Object3D[]>([]);
  const startScale = useRef(1);
  const prevPrimary = useRef(new Vector3());
  const lastValid = useRef<Snapshot>({
    position: new Vector3(),
    rotation: new Euler(),
    scale: new Vector3(1, 1, 1),
  });

  const saveValid = useCallback((obj: Object3D): void => {
    lastValid.current.position.copy(obj.position);
    lastValid.current.rotation.copy(obj.rotation);
    lastValid.current.scale.copy(obj.scale);
  }, []);

  const onDragStart = useCallback((): void => {
    if (!target) return;
    saveValid(target);
    startScale.current = target.scale.x;
    prevPrimary.current.copy(target.position);
    const { selectedId, selectedIds, template } = useEditorStore.getState();
    others.current = selectedIds
      .filter((id) => id !== selectedId)
      .map((id) => objects.current.get(id))
      .filter((o): o is Object3D => !!o);
    const single = selectedIds.length <= 1;
    const selfCollides = template.props.find((p) => p.id === selectedId)?.collides ?? false;
    obstacles.current =
      single && selfCollides
        ? collectObstacles(selectedId ?? '', worldModelBox(target), objects, template.props)
        : [];
  }, [target, objects, saveValid]);

  const onObjectChange = useCallback((): void => {
    if (!target) return;
    if (gizmoMode === 'scale') uniformizeScale(target, startScale.current);
    if (gizmoMode === 'translate' && others.current.length > 0) {
      const delta = target.position.clone().sub(prevPrimary.current);
      for (const obj of others.current) obj.position.add(delta);
      prevPrimary.current.copy(target.position);
      return;
    }
    if (obstacles.current.length === 0) return;
    if (hasNewCollision(worldModelBox(target), obstacles.current)) {
      target.position.copy(lastValid.current.position);
      target.rotation.copy(lastValid.current.rotation);
      target.scale.copy(lastValid.current.scale);
    } else {
      saveValid(target);
    }
  }, [target, gizmoMode, saveValid]);

  return { onDragStart, onObjectChange };
}

function readTransform(obj: Object3D): PropPatch['patch'] {
  return {
    position: obj.position.toArray() as Vec3,
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: obj.scale.x,
  };
}

export function EditorTransformGizmo({ objects }: EditorTransformGizmoProps): ReactElement | null {
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectedCount = useEditorStore((s) => s.selectedIds.length);
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const propCount = useEditorStore((s) => s.template.props.length);
  const [, forceRender] = useState(0);

  useEffect(() => {
    forceRender((n) => n + 1);
  }, [selectedId, selectedCount, propCount]);

  const target = selectedId ? (objects.current.get(selectedId) ?? null) : null;
  const { onDragStart, onObjectChange } = useGizmoDrag(target, gizmoMode, objects);

  const commit = useCallback((): void => {
    if (!target) return;
    const store = useEditorStore.getState();
    if (store.snapToGrid) {
      const snapped = snapVec(target.position.toArray() as Vec3);
      target.position.set(snapped[0], snapped[1], snapped[2]);
    }
    const updates: PropPatch[] = store.selectedIds
      .map((id) => ({ id, obj: objects.current.get(id) }))
      .filter((e): e is { id: string; obj: Object3D } => !!e.obj)
      .map((e) => ({ id: e.id, patch: readTransform(e.obj) }));
    store.batchUpdateProps(updates);
  }, [target]);

  if (!target) return null;
  return (
    <TransformControls
      object={target}
      mode={gizmoMode}
      onMouseDown={onDragStart}
      onObjectChange={onObjectChange}
      onMouseUp={commit}
    />
  );
}

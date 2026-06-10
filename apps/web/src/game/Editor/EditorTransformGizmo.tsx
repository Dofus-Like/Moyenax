import { TransformControls } from '@react-three/drei';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Euler, type Object3D, Vector3 } from 'three';

import type { Vec3 } from '@game/shared-types';

import { type GizmoMode, snapVec, useEditorStore } from '../../store/editor.store';

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

interface CollisionGuard {
  onDragStart: () => void;
  onObjectChange: () => void;
}

// Force uniform scaling: dragging any scale handle (or the centre) grows the prop
// equally on the 3 axes, driven by the axis that deviates most from the start scale.
function uniformizeScale(obj: Object3D, startScale: number): void {
  const ratios = [obj.scale.x / startScale, obj.scale.y / startScale, obj.scale.z / startScale];
  const ratio = ratios.reduce(
    (best, cur) => (Math.abs(cur - 1) > Math.abs(best - 1) ? cur : best),
    1,
  );
  obj.scale.setScalar(Math.max(0.05, startScale * ratio));
}

// Blocks a transform that would push a collidable prop into another. Pre-existing
// overlaps are ignored so two already-merged objects can still be pulled apart.
function useCollisionGuard(
  target: Object3D | null,
  selectedId: string | null,
  gizmoMode: GizmoMode,
  objects: ObjectsRef,
): CollisionGuard {
  const obstacles = useRef<Obstacle[]>([]);
  const startScale = useRef(1);
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
    if (!target || !selectedId) return;
    saveValid(target);
    startScale.current = target.scale.x;
    const { props } = useEditorStore.getState().template;
    const selfCollides = props.find((p) => p.id === selectedId)?.collides ?? false;
    obstacles.current = selfCollides
      ? collectObstacles(selectedId, worldModelBox(target), objects, props)
      : [];
  }, [target, selectedId, objects, saveValid]);

  const onObjectChange = useCallback((): void => {
    if (!target) return;
    if (gizmoMode === 'scale') uniformizeScale(target, startScale.current);
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

export function EditorTransformGizmo({ objects }: EditorTransformGizmoProps): ReactElement | null {
  const selectedId = useEditorStore((s) => s.selectedId);
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const propCount = useEditorStore((s) => s.template.props.length);
  const updateProp = useEditorStore((s) => s.updateProp);
  const [, forceRender] = useState(0);

  useEffect(() => {
    forceRender((n) => n + 1);
  }, [selectedId, propCount]);

  const target = selectedId ? (objects.current.get(selectedId) ?? null) : null;
  const { onDragStart, onObjectChange } = useCollisionGuard(target, selectedId, gizmoMode, objects);

  const commit = useCallback((): void => {
    if (!selectedId || !target) return;
    const raw = target.position.toArray() as Vec3;
    const position = useEditorStore.getState().snapToGrid ? snapVec(raw) : raw;
    target.position.set(position[0], position[1], position[2]);
    updateProp(selectedId, {
      position,
      rotation: [target.rotation.x, target.rotation.y, target.rotation.z],
      scale: target.scale.x,
    });
  }, [selectedId, target, updateProp]);

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

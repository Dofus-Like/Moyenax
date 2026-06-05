import type { PlacedProp, Vec3 } from '@game/shared-types';

export type Axis = 'x' | 'z';
export type AlignMode = 'min' | 'center' | 'max';

function axisIndex(axis: Axis): 0 | 2 {
  return axis === 'x' ? 0 : 2;
}

function withAxis(position: Vec3, index: number, value: number): Vec3 {
  const next = [...position] as Vec3;
  next[index] = value;
  return next;
}

function targetsOf(props: PlacedProp[], ids: Set<string>): PlacedProp[] {
  return props.filter((p) => ids.has(p.id) && !p.locked);
}

/** Aligne les props sélectionnées sur un bord/centre de l'axe donné. */
export function alignProps(
  props: PlacedProp[],
  ids: Set<string>,
  axis: Axis,
  mode: AlignMode,
): PlacedProp[] {
  const index = axisIndex(axis);
  const targets = targetsOf(props, ids);
  if (targets.length < 2) return props;
  const values = targets.map((p) => p.position[index]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  let target = min;
  if (mode === 'max') target = max;
  else if (mode === 'center') target = (min + max) / 2;
  const moving = new Set(targets.map((p) => p.id));
  return props.map((p) =>
    moving.has(p.id) ? { ...p, position: withAxis(p.position, index, target) } : p,
  );
}

/** Répartit régulièrement les props sélectionnées le long de l'axe (entre extrêmes). */
export function distributeProps(props: PlacedProp[], ids: Set<string>, axis: Axis): PlacedProp[] {
  const index = axisIndex(axis);
  const targets = targetsOf(props, ids).sort((a, b) => a.position[index] - b.position[index]);
  if (targets.length < 3) return props;
  const first = targets[0].position[index];
  const last = targets[targets.length - 1].position[index];
  const step = (last - first) / (targets.length - 1);
  const placed = new Map<string, number>();
  for (const [i, p] of targets.entries()) placed.set(p.id, first + i * step);
  return props.map((p) =>
    placed.has(p.id)
      ? { ...p, position: withAxis(p.position, index, placed.get(p.id) as number) }
      : p,
  );
}

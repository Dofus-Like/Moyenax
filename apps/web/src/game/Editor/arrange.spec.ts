import { describe, expect, it } from 'vitest';

import type { PlacedProp } from '@game/shared-types';

import { alignProps, distributeProps } from './arrange';

function prop(id: string, x: number, z = 0, extra: Partial<PlacedProp> = {}): PlacedProp {
  return {
    id,
    modelKey: 'm',
    position: [x, 0, z],
    rotation: [0, 0, 0],
    scale: 1,
    collides: true,
    ...extra,
  };
}

describe('alignProps', () => {
  it('aligne sur le minimum de l’axe X', () => {
    const props = [prop('a', 1), prop('b', 5), prop('c', 3)];
    const out = alignProps(props, new Set(['a', 'b', 'c']), 'x', 'min');
    expect(out.map((p) => p.position[0])).toEqual([1, 1, 1]);
  });

  it('aligne sur le centre', () => {
    const out = alignProps([prop('a', 0), prop('b', 10)], new Set(['a', 'b']), 'x', 'center');
    expect(out.map((p) => p.position[0])).toEqual([5, 5]);
  });

  it('ignore les props verrouillées et hors sélection', () => {
    const props = [prop('a', 1), prop('b', 5, 0, { locked: true }), prop('c', 9)];
    const out = alignProps(props, new Set(['a', 'b', 'c']), 'x', 'max');
    expect(out.find((p) => p.id === 'a')?.position[0]).toBe(9);
    expect(out.find((p) => p.id === 'b')?.position[0]).toBe(5); // verrouillée, intacte
  });

  it('ne fait rien avec moins de 2 cibles', () => {
    const props = [prop('a', 1)];
    expect(alignProps(props, new Set(['a']), 'x', 'min')).toEqual(props);
  });
});

describe('distributeProps', () => {
  it('répartit régulièrement sur Z', () => {
    const props = [prop('a', 0, 0), prop('b', 0, 10), prop('c', 0, 1)];
    const out = distributeProps(props, new Set(['a', 'b', 'c']), 'z');
    const byId = (id: string): number => out.find((p) => p.id === id)?.position[2] ?? Number.NaN;
    expect(byId('a')).toBe(0);
    expect(byId('c')).toBe(5);
    expect(byId('b')).toBe(10);
  });

  it('ne fait rien avec moins de 3 cibles', () => {
    const props = [prop('a', 0, 0), prop('b', 0, 4)];
    expect(distributeProps(props, new Set(['a', 'b']), 'z')).toEqual(props);
  });
});

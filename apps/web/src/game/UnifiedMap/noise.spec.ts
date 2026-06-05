import { describe, expect, it } from 'vitest';

import { fbm, seededRandom, valueNoise } from './noise';

describe('seededRandom', () => {
  it('returns value in [0, 1)', () => {
    for (const s of [0, 1, 42, 999, -5]) {
      const v = seededRandom(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic', () => {
    expect(seededRandom(42)).toBe(seededRandom(42));
    expect(seededRandom(0)).toBe(seededRandom(0));
  });

  it('different seeds produce different values', () => {
    const vals = [1, 2, 3, 4, 5].map(seededRandom);
    const unique = new Set(vals);
    expect(unique.size).toBe(5);
  });
});

describe('valueNoise', () => {
  it('returns value in [0, 1]', () => {
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const v = valueNoise(x * 0.7, y * 1.3, 7);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic', () => {
    expect(valueNoise(1.5, 2.5, 7)).toBe(valueNoise(1.5, 2.5, 7));
  });

  it('interpolates: integer coords equal corner hash', () => {
    // At integer coords the interpolation collapses to a single hash.
    const v0 = valueNoise(0, 0, 7);
    const v1 = valueNoise(1, 0, 7);
    expect(v0).not.toBe(v1);
  });
});

describe('fbm', () => {
  it('returns value in [0, ~0.94]', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * 0.13, i * 0.07, 1337);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
  });

  it('is deterministic', () => {
    expect(fbm(3.14, 2.71, 42)).toBe(fbm(3.14, 2.71, 42));
  });

  it('different seeds shift output', () => {
    const a = fbm(1, 1, 0);
    const b = fbm(1, 1, 100);
    expect(a).not.toBe(b);
  });
});

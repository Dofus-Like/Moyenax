import { describe, it, expect } from 'vitest';

import { getTimeOfDay } from './timeOfDay';

describe('getTimeOfDay', () => {
  it('retourne 0 (day) pour round 1', () => {
    expect(getTimeOfDay(1)).toBe(0);
  });

  it('retourne 1 (sunset) pour round 2', () => {
    expect(getTimeOfDay(2)).toBe(1);
  });

  it('retourne 2 (night) pour round 3', () => {
    expect(getTimeOfDay(3)).toBe(2);
  });

  it('retourne 0 (day) pour round 4', () => {
    expect(getTimeOfDay(4)).toBe(0);
  });

  it('repete le cycle sunset/night pour rounds 5 et 6', () => {
    expect(getTimeOfDay(5)).toBe(1);
    expect(getTimeOfDay(6)).toBe(2);
  });

  it('retourne 0 pour round 7 (nouveau cycle)', () => {
    expect(getTimeOfDay(7)).toBe(0);
  });
});

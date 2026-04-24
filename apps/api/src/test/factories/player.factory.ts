import { PlayerStats } from '@game/shared-types';

export function makePlayerStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    vit: 100,
    atk: 10,
    mag: 10,
    def: 5,
    res: 5,
    ini: 20,
    pa: 6,
    pm: 3,
    baseVit: 100,
    baseAtk: 10,
    baseMag: 10,
    baseDef: 5,
    baseRes: 5,
    baseIni: 20,
    basePa: 6,
    basePm: 3,
    ...overrides,
  };
}

export function makeZeroedStats(): PlayerStats {
  return makePlayerStats({
    vit: 0,
    atk: 0,
    mag: 0,
    def: 0,
    res: 0,
    ini: 0,
    pa: 0,
    pm: 0,
    baseVit: 0,
    baseAtk: 0,
    baseMag: 0,
    baseDef: 0,
    baseRes: 0,
    baseIni: 0,
    basePa: 0,
    basePm: 0,
  });
}

export function makeTankStats(): PlayerStats {
  return makePlayerStats({ vit: 500, def: 100, res: 100, atk: 5, mag: 5 });
}

export function makeGlassCannonStats(): PlayerStats {
  return makePlayerStats({ vit: 50, def: 0, res: 0, atk: 200, mag: 200 });
}

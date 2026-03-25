import { createDefaultPlayerStats, DEFAULT_PLAYER_STATS } from './default-player-stats';

describe('default player stats', () => {
  it('exposes the expected default values', () => {
    expect(DEFAULT_PLAYER_STATS).toEqual({
      vit: 100,
      atk: 10,
      mag: 10,
      def: 5,
      res: 5,
      ini: 100,
      pa: 6,
      pm: 3,
      baseVit: 100,
      baseAtk: 10,
      baseMag: 10,
      baseDef: 5,
      baseRes: 5,
      baseIni: 100,
      basePa: 6,
      basePm: 3,
    });
  });

  it('returns a fresh object for each initialization', () => {
    const first = createDefaultPlayerStats();
    const second = createDefaultPlayerStats();

    first.vit = 0;
    first.baseVit = 0;

    expect(second.vit).toBe(100);
    expect(second.baseVit).toBe(100);
    expect(DEFAULT_PLAYER_STATS.vit).toBe(100);
    expect(DEFAULT_PLAYER_STATS.baseVit).toBe(100);
  });
});

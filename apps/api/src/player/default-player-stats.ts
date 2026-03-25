export interface DefaultPlayerStats {
  vit: number;
  atk: number;
  mag: number;
  def: number;
  res: number;
  ini: number;
  pa: number;
  pm: number;
  baseVit: number;
  baseAtk: number;
  baseMag: number;
  baseDef: number;
  baseRes: number;
  baseIni: number;
  basePa: number;
  basePm: number;
}

export const DEFAULT_PLAYER_STATS: Readonly<DefaultPlayerStats> = Object.freeze({
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

export function createDefaultPlayerStats(): DefaultPlayerStats {
  return { ...DEFAULT_PLAYER_STATS };
}

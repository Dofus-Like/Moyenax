export function getTimeOfDay(round: number): 0 | 1 | 2 {
  return ((round - 1) % 3) as 0 | 1 | 2;
}

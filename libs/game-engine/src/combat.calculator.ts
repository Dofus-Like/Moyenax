import { SpellDefinition, PlayerStats, CombatPosition } from '@game/shared-types';

export function calculateDamage(spell: SpellDefinition, attackerStats: PlayerStats): number {
  const damage = spell.damage.min + Math.floor(Math.random() * (spell.damage.max - spell.damage.min + 1));
  const bonus = Math.floor((attackerStats.strength - 10) * 0.5);
  return Math.max(1, damage + bonus);
}

export function calculateInitiative(stats: PlayerStats): number {
  return stats.initiative + stats.agility + Math.floor(Math.random() * 20);
}

export function isInRange(
  from: CombatPosition,
  to: CombatPosition,
  minRange: number,
  maxRange: number,
): boolean {
  const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  return distance >= minRange && distance <= maxRange;
}

export function canMoveToPosition(
  from: CombatPosition,
  to: CombatPosition,
  remainingMp: number,
  obstacles: CombatPosition[],
): boolean {
  const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  if (distance > remainingMp) return false;

  const isObstacle = obstacles.some((obs) => obs.x === to.x && obs.y === to.y);
  return !isObstacle;
}

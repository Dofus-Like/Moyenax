import { SpellDefinition, PlayerStats, CombatPosition, TerrainType, Tile, TERRAIN_PROPERTIES } from '@game/shared-types';

/**
 * Calcule les dégâts d'un sort en fonction des stats de l'attaquant et de la défense de la cible.
 * Canal Physique: (base + atk) - def
 * Canal Magique: (base + mag) - res
 */
export function calculateDamage(
  spell: SpellDefinition,
  attackerStats: PlayerStats,
  targetStats: PlayerStats,
  isMagical: boolean
): number {
  const baseDamage = spell.damage.min + Math.floor(Math.random() * (spell.damage.max - spell.damage.min + 1));
  const attackerPower = isMagical ? attackerStats.mag : attackerStats.atk;
  const targetDefense = isMagical ? targetStats.res : targetStats.def;
  
  const rawDamage = baseDamage + attackerPower;
  return Math.max(1, rawDamage - targetDefense);
}

/**
 * Calcule les soins d'un sort.
 * Formule: base + (mag * 0.5)
 */
export function calculateHeal(spell: SpellDefinition, attackerStats: PlayerStats): number {
  const baseHeal = spell.damage.min + Math.floor(Math.random() * (spell.damage.max - spell.damage.min + 1));
  return baseHeal + Math.floor(attackerStats.mag * 0.5);
}

/**
 * Jet d'initiative au début du combat.
 * Formule: INI + random(0, 9)
 */
export function calculateInitiativeJet(stats: PlayerStats): number {
  return stats.ini + Math.floor(Math.random() * 10);
}

/**
 * Vérifie si une cible est à portée.
 * Distance Manhattan: |x2-x1| + |y2-y1|
 */
export function isInRange(
  from: CombatPosition,
  to: CombatPosition,
  minRange: number,
  maxRange: number,
): boolean {
  const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  return distance >= minRange && distance <= maxRange;
}

/**
 * Algorithme de Ligne de Vue (Bresenham simplifié ou raycasting grille).
 * Vérifie si un obstacle bloque la vue entre deux points.
 */
export function hasLineOfSight(
  from: CombatPosition,
  to: CombatPosition,
  tiles: Tile[]
): boolean {
  if (from.x === to.x && from.y === to.y) return true;

  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;

  let currX = from.x;
  let currY = from.y;

  while (currX !== to.x || currY !== to.y) {
    // On ne vérifie pas la case de départ ni la case d'arrivée pour les obstacles bloquants "sur le chemin"
    if ((currX !== from.x || currY !== from.y) && (currX !== to.x || currY !== to.y)) {
      const tile = tiles.find(t => t.x === currX && t.y === currY);
      if (tile && TERRAIN_PROPERTIES[tile.type as TerrainType].blockLineOfSight) {
        return false;
      }
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currY += sy;
    }
  }

  return true;
}

/**
 * Vérifie si un déplacement est possible.
 * Chaque pas coûte 1 PM. Pas de diagonale.
 */
export function canMoveTo(
  to: CombatPosition,
  remainingPm: number,
  currentPosition: CombatPosition,
  tiles: Tile[],
  occupiedPositions: CombatPosition[]
): boolean {
  const distance = Math.abs(to.x - currentPosition.x) + Math.abs(to.y - currentPosition.y);
  if (distance === 0 || distance > remainingPm) {
    console.log(`[canMoveTo] Failed: dist=${distance}, pm=${remainingPm}`);
    return false;
  }

  const targetTile = tiles.find(t => t.x === to.x && t.y === to.y);
  if (!targetTile || !TERRAIN_PROPERTIES[targetTile.type as TerrainType].traversable) {
    console.log(`[canMoveTo] Failed: targetTile=${targetTile?.type}, traversable=${targetTile ? TERRAIN_PROPERTIES[targetTile.type as TerrainType].traversable : 'N/A'}`);
    return false;
  }

  const isOccupied = occupiedPositions.some(p => p.x === to.x && p.y === to.y);
  if (isOccupied) {
    console.log(`[canMoveTo] Failed: occupied at ${to.x},${to.y}`);
    return false;
  }

  return true;
}

/**
 * Vérifie si un saut est possible.
 * Le saut permet de passer par dessus 1 case d'eau ou obstacle adjacent.
 * Coûte 1 PM et atterrit 2 cases plus loin.
 */
export function canJumpTo(
  to: CombatPosition,
  remainingPm: number,
  currentPosition: CombatPosition,
  tiles: Tile[],
  occupiedPositions: CombatPosition[]
): boolean {
  if (remainingPm < 1) return false;

  const dx = to.x - currentPosition.x;
  const dy = to.y - currentPosition.y;

  // Saut de exactement 2 cases en ligne droite (H ou V)
  const isStraightJump = (Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0);
  if (!isStraightJump) return false;

  // Vérifier la case intermédiaire
  const midX = currentPosition.x + dx / 2;
  const midY = currentPosition.y + dy / 2;
  const midTile = tiles.find(t => t.x === midX && t.y === midY);
  
  // On ne peut sauter que par dessus de l'eau (jumpable)
  if (!midTile || !TERRAIN_PROPERTIES[midTile.type as TerrainType].jumpable) return false;

  // Vérifier destination
  const targetTile = tiles.find(t => t.x === to.x && t.y === to.y);
  if (!targetTile || !TERRAIN_PROPERTIES[targetTile.type as TerrainType].traversable) return false;

  const isOccupied = occupiedPositions.some(p => p.x === to.x && p.y === to.y);
  if (isOccupied) {
    console.log(`[canJumpTo] Failed: occupied at ${to.x},${to.y}`);
    return false;
  }
  return true;
}

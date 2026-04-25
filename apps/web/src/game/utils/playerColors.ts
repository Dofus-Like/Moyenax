import type { ResourceFamily } from '@game/shared-types';

export interface PlayerColors {
  primary: string;
  secondary: string;
  emissive: string;
}

export const ARCHETYPE_COLORS: Record<ResourceFamily | 'NEUTRAL', PlayerColors> = {
  FORGE: {
    primary: '#dc2626',      // Rouge guerrier
    secondary: '#ea580c',    // Orange
    emissive: '#991b1b',     // Rouge foncé
  },
  ARCANE: {
    primary: '#8b5cf6',      // Violet mage
    secondary: '#7c3aed',    // Violet foncé
    emissive: '#6d28d9',     // Violet très foncé
  },
  NATURE: {
    primary: '#16a34a',      // Vert ninja
    secondary: '#15803d',    // Vert foncé
    emissive: '#166534',     // Vert très foncé
  },
  NEUTRAL: {
    primary: '#6366f1',      // Bleu indigo par défaut
    secondary: '#4338ca',    // Bleu foncé
    emissive: '#3730a3',     // Bleu très foncé
  },
  SPECIAL: {
    primary: '#eab308',      // Jaune doré (pour l'or)
    secondary: '#f59e0b',    // Orange doré
    emissive: '#d97706',     // Orange foncé
  },
};

/**
 * Détermine l'archétype dominant du joueur basé sur son équipement
 * Pour le moment, retourne NEUTRAL par défaut
 * TODO: Analyser l'inventaire quand le système d'équipement sera implémenté
 */
export function getPlayerArchetype(_inventory?: any): ResourceFamily | 'NEUTRAL' {
  // Pour le moment, on retourne NEUTRAL
  // Plus tard, on analysera l'équipement pour déterminer la classe dominante
  // Par exemple:
  // - Compter les items FORGE vs ARCANE vs NATURE équipés
  // - Retourner la famille majoritaire

  return 'NEUTRAL';
}

export function getPlayerColors(_inventory?: any): PlayerColors {
  const archetype = getPlayerArchetype(_inventory);
  return ARCHETYPE_COLORS[archetype];
}

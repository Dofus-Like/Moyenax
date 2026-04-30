import { useEffect, useRef } from 'react';

import type { PathNode, TerrainType} from '@game/shared-types';
import { TERRAIN_PROPERTIES } from '@game/shared-types';

import { useFarmingStore } from '../../../store/farming.store';

interface UseAutoHarvestProps {
  currentPosition: PathNode;
  terrain: TerrainType;
  onHarvest?: (x: number, y: number, resource: string) => Promise<void>;
}

/**
 * Hook qui détecte automatiquement quand le joueur arrive sur une ressource
 * et déclenche la récolte
 */
export function useAutoHarvest({ currentPosition, terrain, onHarvest }: UseAutoHarvestProps) {
  const { setHarvesting, harvestResource } = useFarmingStore();
  const previousPosition = useRef<PathNode | null>(null);

  useEffect(() => {
    // Vérifier si la position a changé
    if (
      previousPosition.current &&
      (previousPosition.current.x !== currentPosition.x || previousPosition.current.y !== currentPosition.y)
    ) {
      // Le joueur vient d'arriver sur une nouvelle tuile
      const terrainProps = TERRAIN_PROPERTIES[terrain];

      if (terrainProps.harvestable && terrainProps.resourceName) {
        // Déclencher la récolte automatique
        setHarvesting(true);

        if (onHarvest) {
          onHarvest(currentPosition.x, currentPosition.y, terrainProps.resourceName)
            .finally(() => {
              setHarvesting(false);
            });
        } else {
          // Mode local sans API (pour le test)
          setTimeout(() => {
            harvestResource(terrainProps.resourceName!, 1);
            setHarvesting(false);
          }, 300);
        }
      }
    }

    previousPosition.current = { ...currentPosition };
  }, [currentPosition, terrain, setHarvesting, harvestResource, onHarvest]);
}

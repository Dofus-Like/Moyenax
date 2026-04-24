import { useEffect, useRef } from 'react';
import { PathNode, TerrainType, TERRAIN_PROPERTIES } from '@game/shared-types';
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
        console.log(`Auto-harvest: ${terrainProps.resourceName} at (${currentPosition.x}, ${currentPosition.y})`);
        
        setHarvesting(true);

        if (onHarvest) {
          onHarvest(currentPosition.x, currentPosition.y, terrainProps.resourceName)
            .then(() => {
              console.log(`Harvested: ${terrainProps.resourceName}`);
            })
            .catch((error) => {
              console.error('Harvest failed:', error);
            })
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

import type { SpellDefinition } from '@game/shared-types';
import { SpellVisualType } from '@game/shared-types';

/**
 * Reproduit le comportement de combat (UnifiedMapScene) : seuls les sorts de type
 * PROJECTILE déclenchent un VFX qui vole vers la cible. `getProjectileType` y choisit
 * le kunaï pour les sorts « kunai », sinon la boule de feu. Les sorts physiques (corps
 * à corps), de soin ou utilitaires ne lancent aucun projectile → null.
 */
export function spellVfxType(spell: SpellDefinition | undefined): string | null {
  if (!spell || spell.visualType !== SpellVisualType.PROJECTILE) return null;
  if (spell.code.includes('kunai')) return 'spell-kunai';
  return 'spell-fireball';
}

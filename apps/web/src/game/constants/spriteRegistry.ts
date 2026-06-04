// Sprites auto-découverts : déposer un dossier src/assets/sprites/<perso>/ avec
// idle.png / walk.png / attack.png le rend utilisable partout (même formule que les
// GLB). Un "perso" = un dossier ayant au moins idle.png.
const spriteMap = import.meta.glob('../../assets/sprites/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const ROOT = '../../assets/sprites/';

export type SpriteAnim = 'idle' | 'walk' | 'attack';

const byKey = new Map<string, string>();
const characters = new Set<string>();

for (const [path, url] of Object.entries(spriteMap)) {
  const rel = path.startsWith(ROOT) ? path.slice(ROOT.length) : path;
  const slash = rel.indexOf('/');
  if (slash < 0) continue;
  const character = rel.slice(0, slash);
  const anim = rel.slice(slash + 1).replace(/\.png$/, '');
  byKey.set(`${character}/${anim}`, url);
  if (anim === 'idle') characters.add(character);
}

/** Personnages de sprites disponibles (dossiers ayant idle.png). */
export const SPRITE_CHARACTERS: string[] = [...characters].sort();

/** URL d'une feuille de sprites (fallback sur idle si l'anim manque). */
export function spriteUrl(character: string, anim: SpriteAnim = 'idle'): string {
  return byKey.get(`${character}/${anim}`) ?? byKey.get(`${character}/idle`) ?? '';
}

/** Toutes les URLs de sprites (préchargement). */
export function allSpriteUrls(): string[] {
  return [...byKey.values()];
}

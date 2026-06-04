// Résout une référence d'asset bundlé (servie auparavant depuis public/assets).
// Les chemins stockés en base (`iconPath`) restent inchangés : on mappe le
// sous-chemin après `/assets/` vers l'URL hashée produite par Vite.
// Résolution par SOUS-CHEMIN (pas par nom) : `items/epee.png` et
// `pack/spells/epee.png` sont deux images distinctes.
const rasters = import.meta.glob('../../assets/{items,icons,vfx,pack}/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const meshes = import.meta.glob('../../assets/models/**/*.{fbx,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const MARKER = '/assets/';

const byKey = new Map<string, string>();
for (const [path, url] of Object.entries({ ...rasters, ...meshes })) {
  const i = path.indexOf(MARKER);
  if (i !== -1) byKey.set(path.slice(i + MARKER.length), url);
}

function toKey(ref: string): string {
  const i = ref.indexOf(MARKER);
  return (i !== -1 ? ref.slice(i + MARKER.length) : ref).replace(/^\/+/, '');
}

/**
 * Résout une référence d'asset (`/assets/items/fer.png`, chemin BD, ou clé
 * `items/fer.png`) vers son URL bundlée. Renvoie la référence telle quelle si
 * inconnue (dégradation gracieuse).
 */
export function assetUrl(ref: string): string {
  return byKey.get(toKey(ref)) ?? ref;
}

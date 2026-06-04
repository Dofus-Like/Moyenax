// Source unique des modèles GLB. Auto-découverte via import.meta.glob (Vite) : déposer
// un .glb dans src/assets/models/<sous-dossier>/ le fait apparaître automatiquement.
// Le dossier `raw/` (variantes lourdes) est EXCLU du glob core → exclu du build prod ;
// il est chargé à part en dev seulement (voir loadRawModels / rawModels.ts).
const coreMap = import.meta.glob(
  ['../../assets/models/**/*.glb', '!../../assets/models/raw/**/*.glb'],
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

const ROOT = '../../assets/models/';

export interface ModelEntry {
  /** Chemin relatif depuis la racine des modèles, ex. "environments/hub.glb". */
  key: string;
  /** Nom de fichier, ex. "hub.glb". */
  name: string;
  /** Sous-dossier (vide à la racine), ex. "environments". */
  folder: string;
  /** URL résolue par Vite (hashée), à passer à useGLTF. */
  url: string;
}

/** Transforme une map { chemin glob → url } en entrées triées. */
export function toModelEntries(urlMap: Record<string, string>): ModelEntry[] {
  return Object.entries(urlMap)
    .map(([path, url]) => {
      const key = path.startsWith(ROOT) ? path.slice(ROOT.length) : path;
      const slash = key.lastIndexOf('/');
      return {
        key,
        name: slash >= 0 ? key.slice(slash + 1) : key,
        folder: slash >= 0 ? key.slice(0, slash) : '',
        url,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export const MODELS: ModelEntry[] = toModelEntries(coreMap);

const BY_KEY = new Map(MODELS.map((m) => [m.key, m.url]));

/** URL d'un modèle par chemin relatif (ex. "environments/hub.glb"). */
export function modelUrl(key: string): string {
  const url = BY_KEY.get(key);
  if (!url) throw new Error(`Modèle GLB introuvable : ${key}`);
  return url;
}

/**
 * Variantes "raw" (lourdes, ex. Hub 51 Mo). Chargées uniquement en dev via un import
 * dynamique gaté `import.meta.env.DEV` → l'arbre mort est tree-shaké en build prod, donc
 * ces assets ne sont jamais émis dans le bundle de production.
 */
export async function loadRawModels(): Promise<ModelEntry[]> {
  if (!import.meta.env.DEV) return [];
  const mod = await import('./rawModels');
  return mod.RAW_MODELS;
}

export interface ModelTreeNode {
  name: string;
  path: string;
  folders: ModelTreeNode[];
  models: ModelEntry[];
}

/** Construit l'arborescence de dossiers (pour refléter le rangement dans l'UI). */
export function buildModelTree(models: ModelEntry[]): ModelTreeNode {
  const root: ModelTreeNode = { name: '', path: '', folders: [], models: [] };
  for (const model of models) {
    const parts = model.folder ? model.folder.split('/') : [];
    let node = root;
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      let child = node.folders.find((f) => f.name === part);
      if (!child) {
        child = { name: part, path: acc, folders: [], models: [] };
        node.folders.push(child);
      }
      node = child;
    }
    node.models.push(model);
  }
  return root;
}

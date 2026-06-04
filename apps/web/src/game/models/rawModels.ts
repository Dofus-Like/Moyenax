import { type ModelEntry, toModelEntries } from './modelRegistry';

// Variantes "raw" (lourdes). Ce module n'est importé que dynamiquement et uniquement
// en dev (loadRawModels) ; en build prod l'import dynamique est tree-shaké, donc ce
// glob — et les assets qu'il référence — ne sont jamais inclus dans le bundle.
const rawMap = import.meta.glob('../../assets/models/raw/**/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const RAW_MODELS: ModelEntry[] = toModelEntries(rawMap);

// Skins auto-découverts : déposer un fichier src/assets/skins/<id>.json l'ajoute
// automatiquement au catalogue (même formule que les modèles GLB). `type` désigne
// le dossier de sprites (src/assets/sprites/<type>/), résolu via spriteRegistry.
export interface SkinConfig {
  id: string;
  name: string;
  type: string;
  hue: number;
  saturation: number;
  description: string;
  sortOrder?: number;
}

const modules = import.meta.glob('../../assets/skins/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, SkinConfig>;

export const SKINS: SkinConfig[] = Object.values(modules).sort(
  (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id),
);

export function getSkinById(id: string): SkinConfig {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

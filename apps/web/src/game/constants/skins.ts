export interface SkinConfig {
  id: string;
  name: string;
  type: 'soldier' | 'orc';
  hue: number;
  saturation: number;
  description: string;
}

export const SKINS: SkinConfig[] = [
  { 
    id: 'soldier-classic', 
    name: 'Guerrier de Chair', 
    type: 'soldier', 
    hue: 0, 
    saturation: 1,
    description: 'L\'équipement standard du garde des fôrets de Chair.'
  },
  { 
    id: 'soldier-royal', 
    name: 'Guerrier Royal', 
    type: 'soldier', 
    hue: 200, 
    saturation: 1.2,
    description: 'Une armure azurée infusée de magie protector.'
  },
  { 
    id: 'soldier-dark', 
    name: 'Chevalier d\'Ébène', 
    type: 'soldier', 
    hue: 0, 
    saturation: 0.1,
    description: 'Un guerrier solitaire aux couleurs ternies par les batailles.'
  },
  { 
    id: 'orc-classic', 
    name: 'Orc Sauvage', 
    type: 'orc', 
    hue: 0, 
    saturation: 1,
    description: 'Peau verte et rage de vaincre.'
  },
  { 
    id: 'orc-fire', 
    name: 'Orc de Sang', 
    type: 'orc', 
    hue: -120, 
    saturation: 1.6,
    description: 'Venu des volcans, sa peau brûle d\'un rouge ardent.'
  },
  { 
    id: 'orc-void', 
    name: 'Orc Corrompu', 
    type: 'orc', 
    hue: 130, 
    saturation: 0.8,
    description: 'Touché par le néant, il arbore des teintes violettes.'
  },
];

export function getSkinById(id: string): SkinConfig {
  return SKINS.find(s => s.id === id) || SKINS[0];
}

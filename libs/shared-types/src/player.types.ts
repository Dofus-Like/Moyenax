export interface PlayerStats {
  vit: number;    // Vitalité
  atk: number;    // Attaque physique
  mag: number;    // Magie
  def: number;    // Défense physique
  res: number;    // Résistance magique
  ini: number;    // Initiative
  pa: number;     // Points d'Action
  pm: number;     // Points de Mouvement
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  statsBonus: Partial<PlayerStats> | null;
  craftCost: Record<string, number> | null;
  shopPrice: number | null;
  // Ajouté pour le système de rangs
  rank?: number;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  item: ItemDefinition;
}

export enum ItemType {
  WEAPON = 'WEAPON',
  ARMOR_HEAD = 'ARMOR_HEAD',
  ARMOR_CHEST = 'ARMOR_CHEST',
  ARMOR_LEGS = 'ARMOR_LEGS',
  ACCESSORY = 'ACCESSORY',
  CONSUMABLE = 'CONSUMABLE',
  RESOURCE = 'RESOURCE',
}

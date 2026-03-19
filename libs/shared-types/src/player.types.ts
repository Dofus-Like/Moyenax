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
  family: string | null;
  statsBonus: Partial<PlayerStats> | null;
  grantsSpells: string[] | null;
  craftCost: Record<string, number> | null;
  shopPrice: number | null;
  rank: number;
}


export interface InventoryItem {
  id: string;
  itemId: string;
  quantity: number;
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

export enum EquipmentSlotType {
  WEAPON_LEFT = 'WEAPON_LEFT',
  WEAPON_RIGHT = 'WEAPON_RIGHT',
  ARMOR_HEAD = 'ARMOR_HEAD',
  ARMOR_CHEST = 'ARMOR_CHEST',
  ARMOR_LEGS = 'ARMOR_LEGS',
  ACCESSORY = 'ACCESSORY',
}

export interface EquipmentSlot {
  slot: EquipmentSlotType;
  inventoryItemId: string | null;
  inventoryItem?: InventoryItem;
}

export type Equipment = Record<EquipmentSlotType, InventoryItem | null>;


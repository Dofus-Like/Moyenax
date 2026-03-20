export interface PlayerStats {
  vit: number;    // Vitalité effective
  atk: number;    // Attaque physique effective
  mag: number;    // Magie effective
  def: number;    // Défense physique effective
  res: number;    // Résistance magique effective
  ini: number;    // Initiative effective
  pa: number;     // Points d'Action effectifs
  pm: number;     // Points de Mouvement effectifs

  baseVit: number; // Vitalité de base
  baseAtk: number;
  baseMag: number;
  baseDef: number;
  baseRes: number;
  baseIni: number;
  basePa: number;
  basePm: number;
}


export interface ItemDefinition {
  id: string;
  name: string;
  description: string | null;
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


export interface PlayerStats {
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  mp: number;
  maxMp: number;
  strength: number;
  agility: number;
  initiative: number;
}
export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  statsBonus: Partial<PlayerStats> | null;
  craftCost: Record<string, number> | null;
  shopPrice: number | null;
}
export interface InventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  item: ItemDefinition;
}
export declare enum ItemType {
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  RING = 'RING',
  CONSUMABLE = 'CONSUMABLE',
  RESOURCE = 'RESOURCE',
}

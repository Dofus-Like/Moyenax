type ShopVisualableItem = {
  type?: string | null;
  family?: string | null;
};

const ITEM_TYPE_ICONS: Record<string, string> = {
  WEAPON: '⚔️',
  ARMOR_HEAD: '⛑️',
  ARMOR_CHEST: '🛡️',
  ARMOR_LEGS: '🥾',
  ACCESSORY: '💍',
  CONSUMABLE: '🧪',
  RESOURCE: '🪨',
};

const FAMILY_ICONS: Record<string, string> = {
  FORGE: '🔥',
  ARCANE: '✨',
  NATURE: '🌿',
  SPECIAL: '👑',
};

export function getItemVisualMeta(item: ShopVisualableItem): { icon: string; toneClass: string } {
  const family = item.family?.toUpperCase() ?? '';
  const type = item.type?.toUpperCase() ?? '';

  return {
    icon: FAMILY_ICONS[family] ?? ITEM_TYPE_ICONS[type] ?? '🎒',
    toneClass: family ? family.toLowerCase() : 'neutral',
  };
}

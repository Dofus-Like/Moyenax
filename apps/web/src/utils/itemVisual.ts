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

interface ItemVisualInput {
  family?: string;
  type?: string;
  iconPath?: string;
}

export function getItemVisualMeta(item: ItemVisualInput): { icon: string; iconPath?: string; toneClass: string } {
  const family = item.family?.toUpperCase() ?? '';
  const type = item.type?.toUpperCase() ?? '';

  return {
    icon: FAMILY_ICONS[family] ?? ITEM_TYPE_ICONS[type] ?? '🎒',
    iconPath: item.iconPath,
    toneClass: family ? family.toLowerCase() : 'neutral',
  };
}

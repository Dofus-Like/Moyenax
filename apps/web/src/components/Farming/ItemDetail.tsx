import React from 'react';
import { useTranslation } from '../../store/language.store';
import { getResourceIconPath } from '../../utils/resourceIcons';
import './ItemDetail.css';

interface ItemDetailProps {
  item: any;
  allItems?: any[];
}

const STAT_LABELS: Record<string, string> = {
  vit: 'PV',
  atk: 'ATK',
  mag: 'MAG',
  def: 'DEF',
  res: 'RES',
  ini: 'INI',
  pa: 'PA',
  pm: 'PM',
};

function getStatsBonus(item: any): Record<string, number> | null {
  if (item.statsBonus) return item.statsBonus;
  if (item.item?.statsBonus) return item.item.statsBonus;
  return null;
}

function getCraftCost(item: any): Record<string, number> | null {
  if (item.craftCost) return item.craftCost;
  if (item.item?.craftCost) return item.item.craftCost;
  return null;
}

function getDescription(item: any): string | null {
  if (item.description) return item.description;
  if (item.item?.description) return item.item.description;
  return null;
}

function getIngredientIcon(itemId: string, allItems: any[]): string {
  const found = allItems.find(it => it.id === itemId) || allItems.find(it => it.name?.toLowerCase() === itemId.toLowerCase());
  if (found?.iconPath) return found.iconPath;
  return getResourceIconPath(found?.name || itemId);
}

function getIngredientName(itemId: string, allItems: any[]): string {
  const found = allItems.find(it => it.id === itemId) || allItems.find(it => it.name?.toLowerCase() === itemId.toLowerCase());
  return found?.name || itemId;
}

export const ItemDetail = ({ item, allItems = [] }: ItemDetailProps) => {
  const { t } = useTranslation();
  if (!item) return <div className="item-detail-empty">{t('selectItem')}</div>;

  const statsBonus = getStatsBonus(item);
  const craftCost = getCraftCost(item);
  const description = getDescription(item);
  const itemType = item.type || item.item?.type;

  return (
    <div className="item-detail-card">
      <div className="item-detail-header">
        <div className="item-type-badge">{itemType || t('item')}</div>
        <h3>{item.name}</h3>
      </div>

      {description && (
        <div className="item-detail-description">{description}</div>
      )}

      {statsBonus && (
        <div className="item-detail-effects">
          {Object.entries(statsBonus).map(([stat, val]) =>
            val !== 0 && (
              <span key={stat} className="effect-badge">
                {STAT_LABELS[stat] || stat.toUpperCase()}: +{val as number}
              </span>
            )
          )}
        </div>
      )}

      {craftCost && (
        <div className="item-detail-recipe">
          {Object.entries(craftCost).map(([resId, qty]) => (
            <div key={resId} className="recipe-item">
              <img
                src={getIngredientIcon(resId, allItems)}
                alt={getIngredientName(resId, allItems)}
                className="recipe-ingredient-icon"
              />
              <span className="res-count">{qty as number}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

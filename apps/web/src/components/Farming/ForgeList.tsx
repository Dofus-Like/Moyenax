import React from 'react';

import { assetUrl } from '../../game/constants/assetUrl';
import { getResourceIconPath } from '../../utils/resourceIcons';
import './ForgeList.css';

interface ForgeListProps {
  items: any[];
  allItems?: any[];
  onItemClick?: (item: any) => void;
  onItemHover?: (item: any | null) => void;
  onItemDoubleClick?: (item: any) => void;
}

export const ForgeList = ({ items, allItems = [], onItemClick, onItemHover, onItemDoubleClick }: ForgeListProps) => {
  const getIngredientIcon = (itemId: string) => {
    // Try to find by ID first, then by Name if itemId looks like a name
    const found = allItems.find(it => it.id === itemId) || 
                  allItems.find(it => it.name.toLowerCase() === itemId.toLowerCase());
    
    if (found?.iconPath) return found.iconPath;
    return getResourceIconPath(found?.name || itemId);
  };
  return (
    <div className="forge-list-container">
      {items.map((item) => (
        <div 
          key={item.id} 
          className="forge-item-row"
          onClick={() => onItemClick?.(item)}
          onMouseEnter={() => onItemHover?.(item)}
          onMouseLeave={() => onItemHover?.(null)}
          onDoubleClick={() => onItemDoubleClick?.(item)}
        >
          <div className="forge-item-main">
            <div className="forge-item-icon">
              <img src={assetUrl(item.iconPath || `/assets/items/${item.id}.png`)} alt={item.name} />
            </div>
            <div className="forge-item-info">
              <div className="forge-item-name">{item.name}</div>
              <div className="forge-item-stats">
                {Object.entries(item.statsBonus || {}).map(([stat, val]: [string, any]) => (
                  val !== 0 && <span key={stat} className="stat-badge">{stat}: +{val}</span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="forge-item-recipe">
            {Object.entries(item.craftCost || {}).map(([resId, qty]: [string, any]) => {
              const ingredient = allItems.find(it => it.id === resId);
              return (
                <div key={resId} className="recipe-ingredient">
                  <img src={getIngredientIcon(resId)} alt={ingredient?.name || resId} />
                  <span>{qty}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

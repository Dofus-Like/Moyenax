import React from 'react';

import { assetUrl } from '../../game/constants/assetUrl';
import { getResourceIconPath } from '../../utils/resourceIcons';
import './FarmingInventoryHUD.css';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  iconPath?: string;
}

interface FarmingInventoryHUDProps {
  items: InventoryItem[];
}

export const FarmingInventoryHUD = ({ items = [] }: FarmingInventoryHUDProps) => {
  // Only show items with quantity > 0
  const activeItems = items.filter(item => item.quantity > 0);

  if (activeItems.length === 0) return null;

  return (
    <div className="farming-inventory-hud">
      <div className="inventory-hud-title">SAC DE RÉCOLTE</div>
      <div className="inventory-hud-grid">
        {activeItems.map((item) => (
          <div key={item.id} className="inventory-hud-item" title={item.name}>
            <img 
              src={assetUrl(item.iconPath || getResourceIconPath(item.name))}
              alt={item.name} 
              className="inventory-item-icon" 
            />
            <span className="inventory-item-count">x{item.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

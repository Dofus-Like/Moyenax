import React from 'react';
import './InventoryGrid.css';

interface InventoryGridProps {
  items: any[];
  onItemHover: (item: any | null) => void;
  onItemClick: (item: any) => void;
  onItemDoubleClick: (item: any) => void;
  showPrice?: boolean;
  spendableGold?: number;
  goldLabel?: string;
}

export const InventoryGrid = ({
  items = [],
  onItemHover,
  onItemClick,
  onItemDoubleClick,
  showPrice = false,
  spendableGold = 0,
  goldLabel = 'Po',
}: InventoryGridProps) => {
  const slots = Array(Math.max(15, items.length)).fill(null);
  items.forEach((item, index) => {
    if (index < slots.length) slots[index] = item;
  });

  return (
    <div className="inventory-grid-container">
      <div className="inventory-grid">
        {slots.map((item, index) => (
          <div 
            key={`slot-${index}`}
            className={`inventory-slot ${item ? 'has-item' : 'empty'} ${showPrice && item && spendableGold < (item.shopPrice ?? 0) ? 'unaffordable' : ''}`}
            onMouseEnter={() => onItemHover(item)}
            onMouseLeave={() => onItemHover(null)}
            onClick={() => item && onItemClick(item)}
            onDoubleClick={() => item && onItemDoubleClick(item)}
            draggable={!!item}
            onDragStart={(e) => {
              if (item) {
                e.dataTransfer.setData('item', JSON.stringify(item));
                // Notify parent that drag started
                document.dispatchEvent(new CustomEvent('item-drag-start'));
              }
            }}
          >
            {item && (
              <>
                <img src={item.iconPath || `/assets/items/${item.itemId || item.id}.png`} alt={item.name} className="item-icon" />
                {item.quantity > 1 && (
                  <span className="item-quantity">x{item.quantity}</span>
                )}
                {showPrice && item.shopPrice != null && (
                  <span className="item-price">💰 {item.shopPrice} {goldLabel}</span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

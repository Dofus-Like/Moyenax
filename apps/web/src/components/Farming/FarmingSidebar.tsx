import React, { useState, useEffect } from 'react';
import { InventoryGrid } from './InventoryGrid';
import { ForgeList } from './ForgeList';
import { Mannequin } from './Mannequin';
import { ItemDetail } from './ItemDetail';
import { TERRAIN_PROPERTIES, TerrainType } from '@game/shared-types';
import { getResourceIconPath } from '../../utils/resourceIcons';
import { useTranslation } from '../../store/language.store';
import './FarmingSidebar.css';

interface FarmingSidebarProps {
  inventory: any[];
  forgeItems: any[];
  shopItems: any[];
  allItems?: any[];
  equipment: any;
  resources: Record<string, number>;
  spendableGold?: number;
  onEquip: (item: any) => void;
  onUnequip: (slot: any) => void;
  onCraft: (item: any) => void;
  onBuy: (item: any) => void;
  hoverInfo?: { x: number; y: number; terrain: TerrainType } | null;
  previewPath?: { x: number; y: number }[];
}

export const FarmingSidebar = ({ 
  inventory = [], 
  forgeItems = [], 
  shopItems = [],
  allItems = [],
  equipment = {}, 
  resources = {},
  spendableGold = 0,
  onEquip,
  onUnequip,
  onCraft,
  onBuy,
  hoverInfo,
  previewPath = []
}: FarmingSidebarProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'inventory' | 'forge' | 'boutique'>('inventory');
  const [bottomMode, setBottomMode] = useState<'mannequin' | 'detail'>('mannequin');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'WEAPON' | 'ARMOR' | 'ACCESSORY'>('ALL');
  const [craftableFilter, setCraftableFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');

  // Handle drag start event from document (triggered by InventoryGrid)
  useEffect(() => {
    const handleDragStart = () => setBottomMode('mannequin');
    document.addEventListener('item-drag-start', handleDragStart);
    return () => document.removeEventListener('item-drag-start', handleDragStart);
  }, []);

  const handleItemHover = (item: any | null) => {
    if (item) {
      setSelectedItem(item);
      setBottomMode('detail');
    } else {
      setBottomMode('mannequin');
    }
  };

  const handleAction = (action: (item: any) => void, item: any) => {
    action(item);
    setBottomMode('mannequin');
  };

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
    setBottomMode('detail');
  };

  const getAvailableQuantity = (resourceItemId: string) => {
    const resource = allItems.find((item) => item.id === resourceItemId);
    if (resource?.name === 'Or') return spendableGold;

    const inventoryQuantity = inventory
      .filter((entry) => entry.itemId === resourceItemId)
      .reduce((total, entry) => total + (entry.quantity || 0), 0);

    if (inventoryQuantity > 0) return inventoryQuantity;
    return resource?.name ? (resources[resource.name] || 0) : (resources[resourceItemId] || 0);
  };

  return (
    <aside className="farming-sidebar">
      <div className="sidebar-section section-top">
        <header className="sidebar-header">
          <button 
            className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            🎒 {t('bag')}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'forge' ? 'active' : ''}`}
            onClick={() => setActiveTab('forge')}
          >
            🔨 {t('forge')}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'boutique' ? 'active' : ''}`}
            onClick={() => setActiveTab('boutique')}
          >
            💰 {t('shop')}
          </button>
        </header>

        <div className="filter-bar">
          <div className="filter-group">
            <button className={`filter-btn ${typeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setTypeFilter('ALL')}>{t('all')}</button>
            <button className={`filter-btn ${typeFilter === 'WEAPON' ? 'active' : ''}`} onClick={() => setTypeFilter('WEAPON')}>{t('weapons')}</button>
            <button className={`filter-btn ${typeFilter === 'ARMOR' ? 'active' : ''}`} onClick={() => setTypeFilter('ARMOR')}>{t('armors')}</button>
            <button className={`filter-btn ${typeFilter === 'ACCESSORY' ? 'active' : ''}`} onClick={() => setTypeFilter('ACCESSORY')}>{t('accessoriesShort')}</button>
          </div>
          {activeTab === 'forge' && (
            <div className="filter-group">
              <button className={`filter-btn ${craftableFilter === 'YES' ? 'active' : ''}`} onClick={() => setCraftableFilter(craftableFilter === 'YES' ? 'ALL' : 'YES')}>🔨 OK</button>
            </div>
          )}
        </div>

        {activeTab === 'boutique' && (
          <div className="sidebar-wallet">
            <span className="sidebar-wallet-label">{t('currentBalance')}</span>
            <strong>💰 {spendableGold}</strong>
            <span>{t('goldUnit')}</span>
          </div>
        )}
        
        <div className="sidebar-content">
          {(() => {
            const filterItem = (it: any) => {
              const type = it.type || it.item?.type;
              if (typeFilter === 'WEAPON' && type !== 'WEAPON') return false;
              if (typeFilter === 'ARMOR' && !['ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(type)) return false;
              if (typeFilter === 'ACCESSORY' && type !== 'ACCESSORY') return false;
              
              if (activeTab === 'forge' && craftableFilter === 'YES') {
                const costs = it.craftCost || {};
                const canCraft = Object.entries(costs).every(([resId, qty]) => getAvailableQuantity(resId) >= (qty as number));
                if (!canCraft) return false;
              }
              return true;
            };

            if (activeTab === 'inventory') {
              return (
                <InventoryGrid 
                  items={inventory.filter(filterItem)} 
                  onItemHover={handleItemHover}
                  onItemClick={handleItemClick}
                  onItemDoubleClick={(item) => handleAction(onEquip, item)}
                />
              );
            }
            if (activeTab === 'forge') {
              return (
                <ForgeList 
                  items={forgeItems.filter(filterItem)} 
                  allItems={allItems}
                  onItemHover={handleItemHover}
                  onItemClick={handleItemClick}
                  onItemDoubleClick={(item) => handleAction(onCraft, item)}
                />
              );
            }
            if (activeTab === 'boutique') {
              return (
                <InventoryGrid 
                  items={shopItems.filter(filterItem)} 
                  onItemHover={handleItemHover}
                  onItemClick={handleItemClick}
                  onItemDoubleClick={(item) => handleAction(onBuy, item)}
                  showPrice
                  spendableGold={spendableGold}
                  goldLabel={t('goldUnit')}
                />
              );
            }
          })()}
        </div>
      </div>

      <div className="sidebar-section section-bottom">
        <div className="sidebar-content-bottom">
          {hoverInfo && TERRAIN_PROPERTIES[hoverInfo.terrain].harvestable ? (
            <div className="item-detail-card tile-detail-card">
              <div className="item-detail-header">
                <div className="item-type-badge">Tuile</div>
                <h3>{hoverInfo.terrain}</h3>
              </div>
              <div className="item-detail-visual">
                <img
                  src={getResourceIconPath(TERRAIN_PROPERTIES[hoverInfo.terrain].resourceName)}
                  alt={hoverInfo.terrain}
                  className="detail-icon"
                />
              </div>
              <div className="item-detail-stats">
                <div className="stat-row">
                  <span className="stat-label">Coords</span>
                  <span className="stat-value">({hoverInfo.x}, {hoverInfo.y})</span>
                </div>
                {previewPath.length > 0 && (
                  <div className="stat-row">
                    <span className="stat-label">{t('tileDistance', { count: previewPath.length })}</span>
                  </div>
                )}
              </div>
            </div>
          ) : bottomMode === 'mannequin' ? (
            <Mannequin 
              equipment={equipment} 
              onUnequip={(slot) => handleAction(onUnequip, slot)} 
            />
          ) : (
            <ItemDetail item={selectedItem} />
          )}
        </div>
      </div>
    </aside>
  );
};

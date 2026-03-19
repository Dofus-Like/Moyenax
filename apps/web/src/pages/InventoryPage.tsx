import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../api/inventory.api';
import { equipmentApi } from '../api/equipment.api';
import { playerApi } from '../api/player.api';
import { Mannequin } from '../components/Mannequin';
import { EquipmentSlotType, InventoryItem, ItemType } from '@game/shared-types';
import './InventoryPage.css';


export function InventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = React.useState<InventoryItem | null>(null);

  const { data: inventory, isLoading: invLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getInventory(),
  });


  const { data: equipment, isLoading: eqLoading } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.getEquipment(),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['player-stats'],
    queryFn: () => playerApi.getStats(),
  });

  const equipMutation = useMutation({
    mutationFn: ({ slot, id }: { slot: EquipmentSlotType; id: string }) => 
      equipmentApi.equip(slot, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
    },
  });

  const unequipMutation = useMutation({
    mutationFn: (slot: EquipmentSlotType) => equipmentApi.unequip(slot),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
    },
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('inventoryItemId', id);
  };

  const handleDoubleClick = (inv: InventoryItem) => {
    const type = inv.item.type;
    let targetSlot: EquipmentSlotType | null = null;

    if (type === ItemType.WEAPON) {
      // Priorité à droite si vide, sinon gauche (écrase gauche si les deux sont pleins)
      targetSlot = equipment?.data?.WEAPON_RIGHT 
        ? EquipmentSlotType.WEAPON_LEFT 
        : EquipmentSlotType.WEAPON_RIGHT;
    } else if (type === ItemType.ARMOR_HEAD) {
      targetSlot = EquipmentSlotType.ARMOR_HEAD;
    } else if (type === ItemType.ARMOR_CHEST) {
      targetSlot = EquipmentSlotType.ARMOR_CHEST;
    } else if (type === ItemType.ARMOR_LEGS) {
      targetSlot = EquipmentSlotType.ARMOR_LEGS;
    } else if (type === ItemType.ACCESSORY) {
      targetSlot = EquipmentSlotType.ACCESSORY;
    }

    if (targetSlot) {
      equipMutation.mutate({ slot: targetSlot, id: inv.id });
    }
  };


  return (
    <div className="inventory-page">
      <header className="inventory-header">
        <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        <h2>🎒 Équipement & Inventaire</h2>
      </header>

      <div className="inventory-main-content">
        <aside className="hero-section">
          <div className="stats-column main-stats">
            <h3>Stats</h3>
            {statsLoading ? (
              <p>...</p>
            ) : (
              <div className="stats-vertical-list">
                {(
                  [
                    { label: 'VIT', current: stats?.data.vit ?? 100, base: stats?.data.baseVit ?? 100 },
                    { label: 'ATK', current: stats?.data.atk ?? 0, base: stats?.data.baseAtk ?? 0 },
                    { label: 'MAG', current: stats?.data.mag ?? 0, base: stats?.data.baseMag ?? 0 },
                    { label: 'DEF', current: stats?.data.def ?? 0, base: stats?.data.baseDef ?? 0 },
                    { label: 'RES', current: stats?.data.res ?? 0, base: stats?.data.baseRes ?? 0 },
                    { label: 'INI', current: stats?.data.ini ?? 0, base: stats?.data.baseIni ?? 0 },
                    { label: 'PA', current: stats?.data.pa ?? 6, base: stats?.data.basePa ?? 6, className: 'stat-pa' },
                    { label: 'PM', current: stats?.data.pm ?? 3, base: stats?.data.basePm ?? 3, className: 'stat-pm' },
                  ] as { label: string; current: number; base: number; className?: string }[]
                ).map((stat) => (

                  <div key={stat.label} className="stat-item">
                    <span>{stat.label}</span>
                    <div className="stat-value-container">
                      <strong className={stat.className || ''}>{stat.current}</strong>
                      {stat.current !== stat.base && (
                        <span className="stat-delta">
                          {stat.current > stat.base ? `(+${stat.current - stat.base})` : `(${stat.current - stat.base})`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mannequin-container">
            {eqLoading ? (
              <p>Chargement...</p>
            ) : (
              <Mannequin 
                equipment={equipment?.data || {}} 
                onEquip={(slot, id) => equipMutation.mutate({ slot, id })}
                onUnequip={(slot) => unequipMutation.mutate(slot)}
              />
            )}
          </div>
        </aside>




        <main className="inventory-list-section">
          <h3>Inventaire</h3>
          <div className="inventory-grid">
            {invLoading && <p className="inventory-loading">Chargement...</p>}
            {inventory?.data?.map((inv: InventoryItem) => (
              <div 
                key={inv.id} 
                className={`inventory-card ${selectedItem?.id === inv.id ? 'selected' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, inv.id)}
                onClick={() => setSelectedItem(inv)}
                onDoubleClick={() => handleDoubleClick(inv)}
              >

                <div className="item-icon">{inv.item.type[0]}</div>
                <div className="item-info">
                  <span className="item-name">{inv.item.name}</span>
                  <span className="item-type">{inv.item.type}</span>
                </div>
                <span className="item-qty">x{inv.quantity}</span>
              </div>
            ))}
          </div>
        </main>

        <aside className="item-details-column">
          <h3>Détails</h3>
          {selectedItem ? (
            <div className="item-details-card">
              <div className="item-details-header">
                <div className="item-details-icon">{selectedItem.item.type[0]}</div>
                <h4>{selectedItem.item.name}</h4>
                <p className="item-details-type">{selectedItem.item.type}</p>
              </div>
              
              <div className="item-details-description">
                <p>"{selectedItem.item.description || 'Un objet mystérieux sans description...'}"</p>
              </div>

              {selectedItem.item.statsBonus && (
                <div className="item-details-stats">
                  <h5>Bonus</h5>
                  <ul>
                    {Object.entries(selectedItem.item.statsBonus).map(([stat, val]) => (
                      <li key={stat}><strong>{stat.toUpperCase()}</strong> : +{val}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="item-details-footer">
                <button 
                  className="equip-button"
                  onClick={() => handleDoubleClick(selectedItem)}
                  disabled={selectedItem.item.type === ItemType.RESOURCE || selectedItem.item.type === ItemType.CONSUMABLE}
                >
                  🚀 Équiper
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-details">
              <p>Cliquez sur un objet pour voir ses détails</p>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}



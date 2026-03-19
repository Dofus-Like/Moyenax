import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../api/inventory.api';
import { equipmentApi } from '../api/equipment.api';
import { playerApi } from '../api/player.api';
import { Mannequin } from '../components/Mannequin';
import { EquipmentSlotType, InventoryItem } from '@game/shared-types';
import './InventoryPage.css';

export function InventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  return (
    <div className="inventory-page">
      <header className="inventory-header">
        <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        <h2>🎒 Équipement & Inventaire</h2>
      </header>

      <div className="inventory-main-content">
        <aside className="mannequin-section">
          <h3>Personnage</h3>
          {eqLoading ? (
            <p>Chargement du mannequin...</p>
          ) : (
            <Mannequin 
              equipment={equipment?.data || {}} 
              onEquip={(slot, id) => equipMutation.mutate({ slot, id })}
              onUnequip={(slot) => unequipMutation.mutate(slot)}
            />
          )}

          <div className="stats-preview">
            <h3>Statistiques</h3>
            {statsLoading ? (
              <p>Calcul...</p>
            ) : (
              <div className="stats-grid">
                <div className="stat-row"><span>VIT</span> <span>{stats?.data.vit}</span></div>
                <div className="stat-row"><span>ATK</span> <span>{stats?.data.atk}</span></div>
                <div className="stat-row"><span>MAG</span> <span>{stats?.data.mag}</span></div>
                <div className="stat-row"><span>DEF</span> <span>{stats?.data.def}</span></div>
                <div className="stat-row"><span>RES</span> <span>{stats?.data.res}</span></div>
                <div className="stat-row"><span>INI</span> <span>{stats?.data.ini}</span></div>
                <div className="stat-row"><span>PA</span> <span className="stat-pa">{stats?.data.pa}</span></div>
                <div className="stat-row"><span>PM</span> <span className="stat-pm">{stats?.data.pm}</span></div>
              </div>
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
                className="inventory-card"
                draggable
                onDragStart={(e) => handleDragStart(e, inv.id)}
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
      </div>
    </div>
  );
}



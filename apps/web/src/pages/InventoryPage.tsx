import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../api/inventory.api';
import './InventoryPage.css';

interface InventoryItemData {
  id: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  item: { id: string; name: string; type: string };
}

export function InventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getInventory(),
  });

  const equipMutation = useMutation({
    mutationFn: (itemId: string) => inventoryApi.equipItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const unequipMutation = useMutation({
    mutationFn: (itemId: string) => inventoryApi.unequipItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  return (
    <div className="inventory-container">
      <header className="inventory-header">
        <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        <h2>🎒 Inventaire</h2>
      </header>

      <div className="inventory-list">
        {isLoading && <p className="inventory-loading">Chargement...</p>}
        {inventory?.data?.map((inv: InventoryItemData) => (
          <div key={inv.id} className={`inventory-item ${inv.equipped ? 'equipped' : ''}`}>
            <div className="inventory-item-info">
              <span className="inventory-item-name">{inv.item.name}</span>
              <span className="inventory-item-type">{inv.item.type}</span>
              <span className="inventory-item-qty">x{inv.quantity}</span>
            </div>
            <button
              className={`inventory-equip-btn ${inv.equipped ? 'unequip' : 'equip'}`}
              onClick={() =>
                inv.equipped
                  ? unequipMutation.mutate(inv.itemId)
                  : equipMutation.mutate(inv.itemId)
              }
            >
              {inv.equipped ? 'Déséquiper' : 'Équiper'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

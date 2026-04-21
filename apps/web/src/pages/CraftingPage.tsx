import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { craftingApi } from '../api/crafting.api';
import { useGameSession } from './GameTunnel';
import { inventoryApi } from '../api/inventory.api';
import { itemsApi } from '../api/items.api';
import { useAuthStore } from '../store/auth.store';
import { getSessionPo } from '../utils/sessionPo';
import { getItemVisualMeta } from '../utils/itemVisual';
import './CraftingPage.css';

interface Item {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  craftCost: Record<string, number>;
}

interface InventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  rank: number;
  item: Item;
}

type FilterType = 'ALL' | 'WEAPON' | 'ARMOR' | 'OTHER';

export function CraftingPage() {
  const isDebugMode = useSearchParams()[0].get('debug') === 'true';
  const { activeSession, refreshSession } = useGameSession();
  const player = useAuthStore((s) => s.player);
  const refreshPlayer = useAuthStore((s) => s.refreshPlayer);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'craft' | 'fusion'>('craft');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { data: recipesRes, isLoading: loadingRecipes } = useQuery({
    queryKey: ['crafting-recipes'],
    queryFn: () => craftingApi.getRecipes(),
  });

  const { data: inventoryRes, isLoading: loadingInventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getInventory(),
  });

  const { data: itemsRes, isLoading: loadingItems } = useQuery({
    queryKey: ['items'],
    queryFn: () => itemsApi.getAll(),
  });

  const recipes = (recipesRes?.data as Recipe[]) || [];
  const inventory = (inventoryRes?.data as InventoryItem[]) || [];
  const allItems = (itemsRes?.data as Item[]) || [];

  const loading = loadingRecipes || loadingInventory || loadingItems;

  useEffect(() => {
    if (activeSession) {
      void refreshSession({ silent: true });
    } else {
      void refreshPlayer();
    }
  }, [activeSession?.id, refreshPlayer, refreshSession]);

  const spendableGold = activeSession ? (getSessionPo(activeSession, player?.id) ?? 0) : (player?.gold ?? 0);

  const getAvailableQuantity = (resourceItemId: string) => {
    const resource = allItems.find((item) => item.id === resourceItemId);
    if (resource?.name === 'Or') {
      return spendableGold;
    }

    return (inventory as InventoryItem[]).find((item) => item.itemId === resourceItemId)?.quantity || 0;
  };

  const handleCraft = async (itemId: string) => {
    try {
      await craftingApi.craftItem(itemId);
      if (activeSession) {
        await refreshSession({ silent: true });
      } else {
        await refreshPlayer();
      }
      setMessage({ text: 'Objet fabriqué avec succès !', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error: any) {
      setMessage({ text: error.response?.data?.message || 'Erreur lors du craft', type: 'error' });
    }
  };

  const handleMerge = async (itemId: string, rank: number) => {
    try {
      await craftingApi.mergeItem(itemId, rank);
      if (activeSession) {
        await refreshSession({ silent: true });
      } else {
        await refreshPlayer();
      }
      setMessage({ text: 'Fusion réussie ! Rang augmenté.', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error: any) {
      setMessage({ text: error.response?.data?.message || 'Erreur lors de la fusion', type: 'error' });
    }
  };

  const filteredCategories = ['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS', 'ACCESSORY', 'CONSUMABLE'].filter(type => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'WEAPON' && type === 'WEAPON') return true;
    if (activeFilter === 'ARMOR' && ['ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(type)) return true;
    if (activeFilter === 'OTHER' && !['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(type)) return true;
    return false;
  });

  return (
    <div className="crafting-page">

      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="crafting-tabs">
        <button 
          className={activeTab === 'craft' ? 'active' : ''} 
          onClick={() => setActiveTab('craft')}
        >
          🔨 Forge (Craft)
        </button>
        <button 
          className={activeTab === 'fusion' ? 'active' : ''} 
          onClick={() => setActiveTab('fusion')}
        >
          ✨ Fusion (Rangs)
        </button>
      </div>

      <div className="item-filters">
        <button className={`filter-btn ${activeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setActiveFilter('ALL')}>Tout</button>
        <button className={`filter-btn ${activeFilter === 'WEAPON' ? 'active' : ''}`} onClick={() => setActiveFilter('WEAPON')}>⚔️ Armes</button>
        <button className={`filter-btn ${activeFilter === 'ARMOR' ? 'active' : ''}`} onClick={() => setActiveFilter('ARMOR')}>🛡️ Armures</button>
        <button className={`filter-btn ${activeFilter === 'OTHER' ? 'active' : ''}`} onClick={() => setActiveFilter('OTHER')}>🎒 Autres</button>
      </div>

      <div className="crafting-content">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : activeTab === 'craft' ? (
          <div className="recipes-container">
            {filteredCategories.map(type => {
              const categoryRecipes = recipes.filter(r => (r as any).type === type);
              if (categoryRecipes.length === 0) return null;

              const typeLabels: Record<string, string> = {
                WEAPON: '⚔️ Armes',
                ARMOR_HEAD: '🪖 Coiffes',
                ARMOR_CHEST: '👕 Capes & Plastrons',
                ARMOR_LEGS: '👢 Bottes',
                ACCESSORY: '💍 Anneaux',
                CONSUMABLE: '🧪 Consommables'
              };

              return (
                <div key={type} className="recipe-category">
                  <h2 className="category-title">{typeLabels[type] || type}</h2>
                  <div className="recipes-grid">
                    {categoryRecipes.map(recipe => {
                      const visual = getItemVisualMeta(recipe);
                      return (
                        <div key={recipe.id} className="recipe-card">
                          <div className="recipe-header">
                            <div className="recipe-visual">
                              {visual.iconPath ? (
                                <img src={visual.iconPath} alt={recipe.name} />
                              ) : (
                                <span className="recipe-emoji">{visual.icon}</span>
                              )}
                            </div>
                            <h3>{recipe.name}</h3>
                            <p>{recipe.description}</p>
                          </div>
                          
                          <div className="recipe-requirements">
                            <h4>Matériaux requis</h4>
                            <div className="cost-list">
                              {Object.entries(recipe.craftCost).map(([resId, qty]) => {
                                const resItem = allItems.find(i => i.id === resId);
                                const resVisual = resItem ? getItemVisualMeta(resItem) : null;
                                const userOwned = getAvailableQuantity(resId);
                                const hasEnough = userOwned >= qty;
                                
                                return (
                                  <div key={resId} className={`cost-item ${hasEnough ? 'met' : 'missing'}`}>
                                    <span className="res-details">
                                      {resVisual?.iconPath ? (
                                        <img src={resVisual.iconPath} alt="" style={{width: 20, height: 20, verticalAlign: 'middle', marginRight: 8}} />
                                      ) : (
                                        <span style={{marginRight: 8}}>{resVisual?.icon || '📦'}</span>
                                      )}
                                      {resItem?.name || 'Ressource'}: <strong>{qty}</strong>
                                    </span>
                                    <span className="owned-status">
                                      ({userOwned})
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <button 
                            className="action-button" 
                            onClick={() => handleCraft(recipe.id)}
                            disabled={loading || Object.entries(recipe.craftCost).some(([resId, qty]) => {
                              const userOwned = getAvailableQuantity(resId);
                              return userOwned < qty;
                            })}
                          >
                            {loading ? 'Forgeage...' : 'Forger l\'objet'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fusion-grid">
            {(inventory as InventoryItem[])
              .filter(item => item.quantity >= 2 && item.rank < 3 && item.item.type !== 'RESOURCE')
              .filter(item => {
                if (activeFilter === 'ALL') return true;
                if (activeFilter === 'WEAPON' && item.item.type === 'WEAPON') return true;
                if (activeFilter === 'ARMOR' && ['ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(item.item.type)) return true;
                if (activeFilter === 'OTHER' && !['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(item.item.type)) return true;
                return false;
              })
              .map(item => (
                <div key={item.id} className="recipe-card">
                  <h3>{item.item.name} <span className="rank-badge">Rang {item.rank}</span></h3>
                  <p>Fusionnez 2 objets de rang {item.rank} pour obtenir un objet de rang {item.rank + 1}.</p>
                  <div className="cost-item">
                    Possédé: <strong>{item.quantity}</strong> / 2 requis
                  </div>
                  <button className="action-button" onClick={() => handleMerge(item.itemId, item.rank)}>Fusionner</button>
                </div>
              ))}
            {(inventory as InventoryItem[])
              .filter(item => item.quantity >= 2 && item.rank < 3 && item.item.type !== 'RESOURCE')
              .filter(item => {
                if (activeFilter === 'ALL') return true;
                if (activeFilter === 'WEAPON' && item.item.type === 'WEAPON') return true;
                if (activeFilter === 'ARMOR' && ['ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(item.item.type)) return true;
                if (activeFilter === 'OTHER' && !['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(item.item.type)) return true;
                return false;
              }).length === 0 && (
              <p className="empty-state">Aucun objet disponible pour cette catégorie.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

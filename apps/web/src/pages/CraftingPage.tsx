import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { craftingApi } from '../api/crafting.api';
import { inventoryApi } from '../api/inventory.api';
import { itemsApi } from '../api/items.api';
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

export function CraftingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'craft' | 'fusion'>('craft');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recipesRes, inventoryRes, itemsRes] = await Promise.all([
        craftingApi.getRecipes(),
        inventoryApi.getInventory(),
        itemsApi.getAll(),
      ]);
      setRecipes(recipesRes.data);
      setInventory(inventoryRes.data);
      setAllItems(itemsRes.data);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCraft = async (itemId: string) => {
    try {
      await craftingApi.craftItem(itemId);
      setMessage({ text: 'Objet fabriqué avec succès !', type: 'success' });
      fetchData();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.message || 'Erreur lors du craft', type: 'error' });
    }
  };

  const handleMerge = async (itemId: string, rank: number) => {
    try {
      await craftingApi.mergeItem(itemId, rank);
      setMessage({ text: 'Fusion réussie ! Rang augmenté.', type: 'success' });
      fetchData();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.message || 'Erreur lors de la fusion', type: 'error' });
    }
  };

  return (
    <div className="crafting-page">
      <header className="crafting-header">
        <button className="back-button" onClick={() => navigate('/')}>Retour</button>
        <h1>Atelier de Forgeron</h1>
      </header>

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

      <div className="crafting-content">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : activeTab === 'craft' ? (
          <div className="recipes-container">
            {['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS', 'ACCESSORY', 'CONSUMABLE'].map(type => {
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
                    {categoryRecipes.map(recipe => (
                      <div key={recipe.id} className="recipe-card">
                        <div className="recipe-header">
                          <h3>{recipe.name}</h3>
                          <p>{recipe.description}</p>
                        </div>
                        
                        <div className="recipe-requirements">
                          <h4>Ressources :</h4>
                          <div className="cost-list">
                            {Object.entries(recipe.craftCost).map(([resId, qty]) => {
                              const resItem = allItems.find(i => i.id === resId);
                              const userOwned = inventory.find(i => i.itemId === resId)?.quantity || 0;
                              const hasEnough = userOwned >= qty;
                              
                              return (
                                <div key={resId} className={`cost-item ${hasEnough ? 'met' : 'missing'}`}>
                                  <span className="res-details">
                                    {resItem?.name || 'Ressource'} : <strong>{qty}</strong>
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
                          disabled={Object.entries(recipe.craftCost).some(([resId, qty]) => {
                            const userOwned = inventory.find(i => i.itemId === resId)?.quantity || 0;
                            return userOwned < qty;
                          })}
                        >
                          Fabriquer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fusion-grid">
            {inventory
              .filter(item => item.quantity >= 2 && item.rank < 3 && item.item.type !== 'RESOURCE')
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
            {inventory.filter(item => item.quantity >= 2 && item.rank < 3 && item.item.type !== 'RESOURCE').length === 0 && (
              <p className="empty-state">Aucun objet disponible pour la fusion (minimum 2 exemplaires de même rang requis).</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

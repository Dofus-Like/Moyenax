import React, { useCallback, useEffect, useState } from 'react';
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
  iconPath?: string;
  statsBonus?: Record<string, number>;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  craftCost: Record<string, number>;
  type?: string;
}

interface InventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  rank: number;
  item: Item;
}

type FilterType = 'ALL' | 'WEAPON' | 'ARMOR' | 'OTHER';

// ── Fusion Drop Slot ────────────────────────────────────────────────────────
function FusionSlot({
  item,
  label,
  onDrop,
  onRemove,
}: {
  item: InventoryItem | null;
  label: string;
  onDrop: (inv: InventoryItem) => void;
  onRemove: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const visual = item ? getItemVisualMeta(item.item) : null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData('application/json');
    if (raw) {
      try { onDrop(JSON.parse(raw) as InventoryItem); } catch { /* ignore */ }
    }
  };

  return (
    <div
      className={`fusion-slot ${isDragOver ? 'drag-over' : ''} ${item ? 'has-item' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {item ? (
        <>
          <div className="fusion-slot-icon">
            {visual?.iconPath
              ? <img src={visual.iconPath} alt={item.item.name} />
              : <span className="fusion-slot-emoji">{visual?.icon ?? '🎒'}</span>
            }
          </div>
          <div className="fusion-slot-info">
            <span className="fusion-slot-name">{item.item.name}</span>
            <span className="fusion-slot-rank">Rang {item.rank}</span>
          </div>
          <button className="fusion-slot-remove" onClick={onRemove} title="Retirer">✕</button>
        </>
      ) : (
        <div className="fusion-slot-empty">
          <span className="fusion-slot-icon-placeholder">+</span>
          <span className="fusion-slot-label">{label}</span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function CraftingPage() {
  const { activeSession, refreshSession } = useGameSession();
  const player = useAuthStore((s) => s.player);
  const refreshPlayer = useAuthStore((s) => s.refreshPlayer);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'craft' | 'fusion'>('craft');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [onlyCraftable, setOnlyCraftable] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fusion drag-and-drop state
  const [fusionSlot1, setFusionSlot1] = useState<InventoryItem | null>(null);
  const [fusionSlot2, setFusionSlot2] = useState<InventoryItem | null>(null);
  const [isMerging, setIsMerging] = useState(false);

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
  }, [activeSession?.id]);

  const spendableGold = activeSession ? (getSessionPo(activeSession, player?.id) ?? 0) : (player?.gold ?? 0);

  const getAvailableQuantity = useCallback((resourceItemId: string) => {
    const resource = allItems.find((i) => i.id === resourceItemId);
    if (resource?.name === 'Or') return spendableGold;
    return inventory.find((i) => i.itemId === resourceItemId)?.quantity || 0;
  }, [allItems, inventory, spendableGold]);

  const isRecipeCraftable = useCallback((recipe: Recipe) => {
    return Object.entries(recipe.craftCost).every(([resId, qty]) => 
      getAvailableQuantity(resId) >= qty
    );
  }, [getAvailableQuantity]);

  const handleCraft = async (itemId: string) => {
    try {
      await craftingApi.craftItem(itemId);
      if (activeSession) await refreshSession({ silent: true });
      else await refreshPlayer();
      setMessage({ text: 'Objet fabriqué avec succès !', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ text: msg || 'Erreur lors du craft', type: 'error' });
    }
  };

  const handleMerge = async (itemId: string, rank: number) => {
    setIsMerging(true);
    try {
      await craftingApi.mergeItem(itemId, rank);
      if (activeSession) await refreshSession({ silent: true });
      else await refreshPlayer();
      setMessage({ text: 'Fusion réussie ! Rang augmenté.', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setFusionSlot1(null);
      setFusionSlot2(null);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ text: msg || 'Erreur lors de la fusion', type: 'error' });
    } finally {
      setIsMerging(false);
    }
  };

  // ── Fusion validation ────────────────────────────────────────────────────
  const fusionValid = fusionSlot1 && fusionSlot2
    && fusionSlot1.itemId === fusionSlot2.itemId
    && fusionSlot1.rank === fusionSlot2.rank
    && fusionSlot1.rank < 3
    && fusionSlot1.id !== fusionSlot2.id;

  const fusionError = fusionSlot1 && fusionSlot2 && !fusionValid
    ? fusionSlot1.id === fusionSlot2.id
      ? 'Vous devez utiliser deux exemplaires différents du même objet.'
      : fusionSlot1.rank !== fusionSlot2.rank
        ? 'Les deux objets doivent être du même rang.'
        : fusionSlot1.itemId !== fusionSlot2.itemId
          ? 'Les deux objets doivent être identiques.'
          : fusionSlot1.rank >= 3
            ? 'Un objet de rang 3 est déjà au rang maximum.'
            : null
    : null;

  const resultItem = fusionValid ? fusionSlot1 : null;
  const resultRank = resultItem ? resultItem.rank + 1 : null;
  const resultVisual = resultItem ? getItemVisualMeta(resultItem.item) : null;
  const resultStats = resultItem?.item.statsBonus;
  
  // Compute boosted stats for preview (+30% per rank)
  const boostedStats = resultStats && resultRank
    ? Object.fromEntries(
        Object.entries(resultStats).map(([k, v]) => [
          k,
          Math.round(v * Math.pow(1.3, resultRank - 1)),
        ])
      )
    : null;

  // All items for slot selection — individual item instances for drag (qty≥1)
  // We show quantity-aware list; duplicates shown as "copies"
  const draggableInventory = inventory
    .filter(i => i.item.type !== 'RESOURCE' && i.rank < 3)
    .filter(i => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'WEAPON' && i.item.type === 'WEAPON') return true;
      if (activeFilter === 'ARMOR' && ['ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(i.item.type)) return true;
      if (activeFilter === 'OTHER' && !['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(i.item.type)) return true;
      return false;
    });

  // ── Category filter for craft tab ───────────────────────────────────────
  const filteredCategories = ['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS', 'ACCESSORY', 'CONSUMABLE'].filter(type => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'WEAPON' && type === 'WEAPON') return true;
    if (activeFilter === 'ARMOR' && ['ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(type)) return true;
    if (activeFilter === 'OTHER' && !['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(type)) return true;
    return false;
  });

  const typeLabels: Record<string, string> = {
    WEAPON: '⚔️ Armes',
    ARMOR_HEAD: '🪖 Coiffes',
    ARMOR_CHEST: '👕 Capes & Plastrons',
    ARMOR_LEGS: '👢 Bottes',
    ACCESSORY: '💍 Anneaux',
    CONSUMABLE: '🧪 Consommables',
  };

  return (
    <div className="crafting-page">
      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="crafting-tabs">
        <button className={activeTab === 'craft' ? 'active' : ''} onClick={() => setActiveTab('craft')}>
          🔨 Forge (Craft)
        </button>
        <button className={activeTab === 'fusion' ? 'active' : ''} onClick={() => setActiveTab('fusion')}>
          ✨ Fusion (Rangs)
        </button>
      </div>

      <div className="item-filters">
        <button className={`filter-btn ${activeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setActiveFilter('ALL')}>Tout</button>
        <button className={`filter-btn ${activeFilter === 'WEAPON' ? 'active' : ''}`} onClick={() => setActiveFilter('WEAPON')}>⚔️ Armes</button>
        <button className={`filter-btn ${activeFilter === 'ARMOR' ? 'active' : ''}`} onClick={() => setActiveFilter('ARMOR')}>🛡️ Armures</button>
        <button className={`filter-btn ${activeFilter === 'OTHER' ? 'active' : ''}`} onClick={() => setActiveFilter('OTHER')}>🎒 Autres</button>
        <div className="filter-divider" />
        <button 
          className={`filter-btn craftable-filter ${onlyCraftable ? 'active' : ''}`} 
          onClick={() => setOnlyCraftable(!onlyCraftable)}
        >
          {onlyCraftable ? '✅ Craftables' : '✨ Tout afficher'}
        </button>
      </div>

      <div className="crafting-content">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : activeTab === 'craft' ? (
          /* ───────────────────── FORGE TAB ─────────────────────── */
          <div className="recipes-container">
            {filteredCategories.map(type => {
              const categoryRecipes = recipes.filter(r => 
                (r as Recipe & { type?: string }).type === type &&
                (!onlyCraftable || isRecipeCraftable(r))
              );
              if (categoryRecipes.length === 0) return null;
              return (
                <div key={type} className="recipe-category">
                  <h2 className="category-title">{typeLabels[type] || type}</h2>
                  <div className="recipes-grid">
                    {categoryRecipes.map(recipe => {
                      const visual = getItemVisualMeta(recipe as unknown as Item);
                      return (
                        <div key={recipe.id} className="recipe-card">
                          <div className="recipe-header">
                            <div className="recipe-visual">
                              {visual.iconPath
                                ? <img src={visual.iconPath} alt={recipe.name} />
                                : <span className="recipe-emoji">{visual.icon}</span>
                              }
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
                                      {resVisual?.iconPath
                                        ? <img src={resVisual.iconPath} alt="" style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 8 }} />
                                        : <span style={{ marginRight: 8 }}>{resVisual?.icon || '📦'}</span>
                                      }
                                      {resItem?.name || 'Ressource'}: <strong>{qty}</strong>
                                    </span>
                                    <span className="owned-status">({userOwned})</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <button
                            className="action-button"
                            onClick={() => handleCraft(recipe.id)}
                            disabled={loading || Object.entries(recipe.craftCost).some(([resId, qty]) =>
                              getAvailableQuantity(resId) < qty
                            )}
                          >
                            {loading ? 'Forgeage...' : "Forger l'objet"}
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
          /* ───────────────────── FUSION TAB ─────────────────────── */
          <div className="fusion-workshop">

            {/* Left panel: draggable inventory list */}
            <aside className="fusion-inventory-panel">
              <h3 className="fusion-panel-title">🎒 Inventaire</h3>
              {draggableInventory.length === 0 ? (
                <p className="empty-state" style={{ padding: 32 }}>Aucun objet à fusionner.</p>
              ) : (
                <div className="fusion-item-list">
                  {draggableInventory.map(inv => {
                    const visual = getItemVisualMeta(inv.item);
                    const isInSlot = fusionSlot1?.id === inv.id || fusionSlot2?.id === inv.id;
                    return (
                      <div
                        key={inv.id}
                        className={`fusion-inv-item ${isInSlot ? 'in-slot' : ''} ${inv.quantity < 2 ? 'low-qty' : ''}`}
                        draggable={!isInSlot}
                        onDragStart={e => {
                          e.dataTransfer.setData('application/json', JSON.stringify(inv));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => {
                          if (isInSlot) return;
                          if (!fusionSlot1) setFusionSlot1(inv);
                          else if (!fusionSlot2 && inv.id !== fusionSlot1.id) setFusionSlot2(inv);
                        }}
                      >
                        <div className="fusion-inv-icon">
                          {visual.iconPath
                            ? <img src={visual.iconPath} alt={inv.item.name} />
                            : <span>{visual.icon}</span>
                          }
                        </div>
                        <div className="fusion-inv-info">
                          <span className="fusion-inv-name">{inv.item.name}</span>
                          <span className="fusion-inv-meta">Rang {inv.rank} · x{inv.quantity}</span>
                        </div>
                        {isInSlot && <span className="fusion-in-slot-badge">Sélectionné</span>}
                        {!isInSlot && inv.quantity < 2 && <span className="fusion-low-badge">x1</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* Center: anvil + slots + preview */}
            <main className="fusion-main-panel">
              <div className="fusion-workspace">

                {/* Drop slots */}
                <div className="fusion-slots-row">
                  <FusionSlot
                    item={fusionSlot1}
                    label="Glisser un objet ici"
                    onDrop={inv => {
                      if (inv.id !== fusionSlot2?.id) setFusionSlot1(inv);
                    }}
                    onRemove={() => setFusionSlot1(null)}
                  />

                  <div className="fusion-plus">+</div>

                  <FusionSlot
                    item={fusionSlot2}
                    label="Glisser un objet ici"
                    onDrop={inv => {
                      if (inv.id !== fusionSlot1?.id) setFusionSlot2(inv);
                    }}
                    onRemove={() => setFusionSlot2(null)}
                  />
                </div>

                {/* Anvil */}
                <div className="fusion-anvil">
                  {/* Placeholder for future image */}
                  <div className="fusion-anvil-placeholder">
                    <span>🔨</span>
                    <span className="fusion-anvil-label">Enclume</span>
                  </div>
                </div>

                {/* Error */}
                {fusionError && (
                  <div className="fusion-error">{fusionError}</div>
                )}

                {/* Result preview */}
                {resultItem && resultRank && (
                  <div className="fusion-preview">
                    <div className="fusion-preview-header">
                      <span className="fusion-preview-label">✨ Résultat de la fusion</span>
                    </div>
                    <div className="fusion-preview-card">
                      <div className="fusion-preview-icon">
                        {resultVisual?.iconPath
                          ? <img src={resultVisual.iconPath} alt={resultItem.item.name} />
                          : <span style={{ fontSize: '2rem' }}>{resultVisual?.icon ?? '🎒'}</span>
                        }
                      </div>
                      <div className="fusion-preview-info">
                        <h4>{resultItem.item.name}</h4>
                        <span className={`fusion-rank-badge rank-${resultRank}`}>Rang {resultRank}</span>
                        {boostedStats && (
                          <div className="fusion-preview-stats">
                            {Object.entries(boostedStats).map(([stat, val]) => (
                              <span key={stat} className="fusion-stat-chip">
                                <strong>{stat.toUpperCase()}</strong> +{val}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fuse button */}
                <button
                  className={`fusion-btn ${fusionValid ? 'ready' : ''}`}
                  disabled={!fusionValid || isMerging}
                  onClick={() => {
                    if (fusionValid && resultItem) {
                      void handleMerge(resultItem.itemId, resultItem.rank);
                    }
                  }}
                >
                  {isMerging
                    ? '⏳ Fusion en cours...'
                    : fusionValid
                      ? '✨ Fusionner'
                      : 'Sélectionner 2 objets identiques'
                  }
                </button>

              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

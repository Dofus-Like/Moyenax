import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { useGameSession } from './GameTunnel';
import { shopApi } from '../api/shop.api';
import { useFarmingStore } from '../store/farming.store';
import { SEED_CONFIGS, SeedId } from '@game/shared-types';
import { getSessionPo } from '../utils/sessionPo';
import { getItemVisualMeta } from '../utils/itemVisual';
import './ShopPage.css';

type FilterType = 'ALL' | 'WEAPON' | 'ARMOR' | 'OTHER';

export function ShopPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const queryClient = useQueryClient();
  const { player, refreshPlayer } = useAuthStore();
  const { activeSession, refreshSession } = useGameSession();
  const { fetchState, seedId } = useFarmingStore();

  const { data: items, isLoading } = useQuery({
    queryKey: ['shop-items'],
    queryFn: () => shopApi.getItems(),
  });

  const buyMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      shopApi.buyItem({ itemId, quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      void refreshPlayer();
      void refreshSession({ silent: true });
    },
  });

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const seedConfig = seedId ? SEED_CONFIGS[seedId as SeedId] : null;

  const isSeedItem = (family: string | null) => {
    if (!seedConfig || !family) return true;
    return seedConfig.families.includes(family as any);
  };

  const sessionPo = getSessionPo(activeSession, player?.id);
  const spendableGold = activeSession ? (sessionPo ?? 0) : (player?.gold ?? 0);
  const balanceLabel = activeSession ? `${sessionPo ?? 0} Po` : `${player?.gold ?? 0} or`;

  return (
    <div className="shop-container">
      <div className="shop-meta-info" style={{ marginBottom: 24, textAlign: 'center' }}>
        {seedConfig && (
          <div className="current-seed-info">
            Saison : <strong>{seedConfig.label}</strong> ({seedConfig.dominantBuild})
          </div>
        )}
        {activeSession && sessionPo === 0 && (
          <p className="shop-po-hint" role="status">
            Gagnez des combats pour recevoir des Po.
          </p>
        )}
      </div>

      <div className="item-filters">
        <button className={`filter-btn ${activeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setActiveFilter('ALL')}>Tout</button>
        <button className={`filter-btn ${activeFilter === 'WEAPON' ? 'active' : ''}`} onClick={() => setActiveFilter('WEAPON')}>⚔️ Armes</button>
        <button className={`filter-btn ${activeFilter === 'ARMOR' ? 'active' : ''}`} onClick={() => setActiveFilter('ARMOR')}>🛡️ Armures</button>
        <button className={`filter-btn ${activeFilter === 'OTHER' ? 'active' : ''}`} onClick={() => setActiveFilter('OTHER')}>🎒 Autres</button>
      </div>

      <div className="shop-grid">
        {isLoading && <p className="shop-loading">Chargement...</p>}
        {items?.data?.filter((item: any) => {
          if (activeFilter === 'ALL') return true;
          if (activeFilter === 'WEAPON' && item.type === 'WEAPON') return true;
          if (activeFilter === 'ARMOR' && ['ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(item.type)) return true;
          if (activeFilter === 'OTHER' && !['WEAPON', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS'].includes(item.type)) return true;
          return false;
        }).map((item: any) => {
          const inSeed = isSeedItem(item.family);
          const price = item.shopPrice ?? 0;
          const visual = getItemVisualMeta(item);
          return (
            <div key={item.id} className={`shop-item-card ${!inSeed ? 'out-of-seed' : ''}`}>
              <div className="shop-item-badges">
                {item.family && (
                  <span className={`family-badge ${item.family.toLowerCase()}`}>{item.family}</span>
                )}
                {!inSeed && <span className="seed-badge">HORS-SEED (-50%)</span>}
              </div>
              <div className="shop-item-visual">
                {visual.iconPath ? (
                  <img src={visual.iconPath} alt={item.name} />
                ) : (
                  <span className="shop-item-emoji">{visual.icon}</span>
                )}
              </div>
              <div className="shop-item-type">{item.type}</div>
              <h3 className="shop-item-name">{item.name}</h3>
              <p className="shop-item-description">{item.description}</p>
              <p className="shop-item-price">💰 {item.shopPrice} Po</p>
              <button
                type="button"
                className="shop-buy-button"
                onClick={() => buyMutation.mutate({ itemId: item.id, quantity: 1 })}
                disabled={buyMutation.isPending || spendableGold < price}
              >
                {buyMutation.isPending ? 'Achat...' : spendableGold < price ? 'Or insuffisant' : 'Acheter'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

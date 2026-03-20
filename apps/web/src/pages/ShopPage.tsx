import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { shopApi } from '../api/shop.api';
import { useFarmingStore } from '../store/farming.store';
import { SEED_CONFIGS, SeedId } from '@game/shared-types';
import './ShopPage.css';

export function ShopPage() {
  const navigate = useNavigate();
  const { fetchState, seedId } = useFarmingStore();
  
  const { data: items, isLoading } = useQuery({
    queryKey: ['shop-items'],
    queryFn: () => shopApi.getItems(),
  });

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const seedConfig = seedId ? SEED_CONFIGS[seedId as SeedId] : null;

  const isSeedItem = (family: string | null) => {
    if (!seedConfig || !family) return true;
    return seedConfig.families.includes(family as any);
  };

  return (
    <div className="shop-container">
      <header className="shop-header">
        <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        <h2>🏪 Boutique</h2>
        {seedConfig && (
          <div className="current-seed-info">
            Saison : <strong>{seedConfig.label}</strong> ({seedConfig.dominantBuild})
          </div>
        )}
      </header>

      <div className="shop-grid">
        {isLoading && <p className="shop-loading">Chargement...</p>}
        {items?.data?.map((item: any) => {
          const inSeed = isSeedItem(item.family);
          return (
            <div key={item.id} className={`shop-item-card ${!inSeed ? 'out-of-seed' : ''}`}>
              <div className="shop-item-badges">
                {item.family && <span className={`family-badge ${item.family.toLowerCase()}`}>{item.family}</span>}
                {!inSeed && <span className="seed-badge warn">HORS-SEED (-50% efficacité)</span>}
              </div>
              <div className="shop-item-type">{item.type}</div>
              <h3 className="shop-item-name">{item.name}</h3>
              <p className="shop-item-price">💰 {item.shopPrice} or</p>
              <button className="shop-buy-button">Acheter</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

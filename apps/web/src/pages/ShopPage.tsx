import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useGameSession } from './GameTunnel';
import { shopApi } from '../api/shop.api';
import { useFarmingStore } from '../store/farming.store';
import { SEED_CONFIGS, SeedId } from '@game/shared-types';
import { getSessionPo } from '../utils/sessionPo';
import { getItemVisualMeta } from '../utils/itemVisual';
import './ShopPage.css';
import './ShopPage.retro.css';

export function ShopPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDebugMode = searchParams.get('debug') === 'true';
  const tunnelQuery = isDebugMode ? '?debug=true' : '';
  const queryClient = useQueryClient();
  const { player, refreshPlayer } = useAuthStore();
  const { activeSession, refreshSession } = useGameSession();
  const showCraftingLink = activeSession?.status === 'ACTIVE' || isDebugMode;
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
      <header className="shop-header">
        <div className="shop-header-nav">
          {(!activeSession || activeSession.status !== 'ACTIVE') && (
            <button type="button" className="back-button" onClick={() => navigate('/')}>
              Lobby
            </button>
          )}
          <button type="button" className="nav-link-btn" onClick={() => navigate('/inventory')}>
            Inventaire
          </button>
          <button type="button" className="nav-link-btn" onClick={() => navigate('/farming')}>
            Farming
          </button>
          {showCraftingLink && (
            <button
              type="button"
              className="nav-link-btn"
              onClick={() => navigate(`/crafting${tunnelQuery}`)}
            >
              Forge
            </button>
          )}
        </div>
        <div className="shop-header-info">
          <h2>
            Boutique {activeSession && <span className="session-badge">SESSION</span>}
          </h2>
          <span className="shop-gold">💰 {balanceLabel}</span>
        </div>
        {seedConfig && (
          <div className="current-seed-info">
            Saison : <strong>{seedConfig.label}</strong> ({seedConfig.dominantBuild})
          </div>
        )}
        {activeSession && sessionPo === 0 && (
          <p className="shop-po-hint" role="status">
            Gagnez un combat pour recevoir des Po (50 en cas de victoire, 25 en cas de
            défaite), puis revenez acheter ici.
          </p>
        )}
      </header>

      <div className="shop-grid">
        {isLoading && <p className="shop-loading">Chargement...</p>}
        {items?.data?.map((item: any) => {
          const inSeed = isSeedItem(item.family);
          const price = item.shopPrice ?? 0;
          const visual = getItemVisualMeta(item);
          return (
            <div key={item.id} className={`shop-item-card ${!inSeed ? 'out-of-seed' : ''}`}>
              <div className="shop-item-badges">
                {item.family && (
                  <span className={`family-badge ${item.family.toLowerCase()}`}>{item.family}</span>
                )}
                {!inSeed && <span className="seed-badge warn">HORS-SEED (-50% efficacité)</span>}
              </div>
              <div className={`shop-item-visual ${visual.toneClass}`} aria-hidden="true">
                <span>{visual.icon}</span>
              </div>
              <div className="shop-item-type">{item.type}</div>
              <h3 className="shop-item-name">{item.name}</h3>
              <p className="shop-item-price">💰 {item.shopPrice} Po</p>
              <button
                type="button"
                className="shop-buy-button"
                onClick={() => buyMutation.mutate({ itemId: item.id, quantity: 1 })}
                disabled={buyMutation.isPending || spendableGold < price}
              >
                {buyMutation.isPending ? 'Achat...' : 'Acheter'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

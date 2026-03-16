import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { shopApi } from '../api/shop.api';
import './ShopPage.css';

export function ShopPage() {
  const navigate = useNavigate();
  const { data: items, isLoading } = useQuery({
    queryKey: ['shop-items'],
    queryFn: () => shopApi.getItems(),
  });

  return (
    <div className="shop-container">
      <header className="shop-header">
        <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        <h2>🏪 Boutique</h2>
      </header>

      <div className="shop-grid">
        {isLoading && <p className="shop-loading">Chargement...</p>}
        {items?.data?.map((item: { id: string; name: string; type: string; shopPrice: number }) => (
          <div key={item.id} className="shop-item-card">
            <div className="shop-item-type">{item.type}</div>
            <h3 className="shop-item-name">{item.name}</h3>
            <p className="shop-item-price">💰 {item.shopPrice} or</p>
            <button className="shop-buy-button">Acheter</button>
          </div>
        ))}
      </div>
    </div>
  );
}

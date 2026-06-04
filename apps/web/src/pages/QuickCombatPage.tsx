import { useQuery } from '@tanstack/react-query';
import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { combatApi } from '../api/combat.api';
import { shopApi } from '../api/shop.api';
import { assetUrl } from '../game/constants/assetUrl';
import './QuickCombatPage.css';

export function QuickCombatPage() {
  const navigate = useNavigate();
  const [ringChoiceLoading, setRingChoiceLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: shopItemsData } = useQuery({
    queryKey: ['shop-items'],
    queryFn: () => shopApi.getItems(),
  });

  const ringOptions = useMemo(() => {
    const items = shopItemsData?.data || [];
    const names = ['Anneau du Guerrier', 'Anneau du Mage', 'Anneau du Ninja'];
    return names.map(name => items.find((i: any) => i.name === name)).filter(Boolean);
  }, [shopItemsData]);

  const handleSelectRing = useCallback(async (ring: any) => {
    if (!ring || ringChoiceLoading) return;
    setRingChoiceLoading(ring.name);
    setError(null);
    try {
      const response = await combatApi.startQuickVsAiCombat(ring.id);
      const sessionId = response.data.sessionId;
      navigate(`/combat/${sessionId}`, { replace: true });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Erreur lors du lancement du combat";
      setError(msg);
    } finally {
      setRingChoiceLoading(null);
    }
  }, [ringChoiceLoading, navigate]);

  return (
    <div className="quick-combat-page">
      <div className="quick-combat-backdrop" />
      <div className="quick-combat-modal">
        <button
          type="button"
          className="quick-combat-back-btn"
          onClick={() => navigate('/')}
        >
          ← Retour
        </button>

        <h2>Combat direct VS AI</h2>
        <p className="quick-combat-desc">
          Choisissez un anneau pour commencer le combat immédiatement.
        </p>

        {error && (
          <div className="quick-combat-error">{error}</div>
        )}

        <div className="quick-combat-ring-grid">
          {ringOptions.length === 0 && (
            <p className="quick-combat-loading">Chargement des anneaux...</p>
          )}
          {ringOptions.map((ring: any) => {
            const bonus = ring.statsBonus || {};
            const stats = [
              bonus.atk && `ATK +${bonus.atk}`,
              bonus.mag && `MAG +${bonus.mag}`,
              bonus.def && `DEF +${bonus.def}`,
              bonus.res && `RES +${bonus.res}`,
              bonus.ini && `INI +${bonus.ini}`,
              bonus.vit && `PV +${bonus.vit}`,
              bonus.pa && `PA +${bonus.pa}`,
              bonus.pm && `PM +${bonus.pm}`,
            ].filter(Boolean);
            return (
              <button
                key={ring.id}
                type="button"
                className="quick-combat-ring-card"
                onClick={() => handleSelectRing(ring)}
                disabled={ringChoiceLoading === ring.name}
              >
                <img
                  src={assetUrl(ring.iconPath || `/assets/items/${ring.id}.png`)}
                  alt={ring.name}
                  className="quick-combat-ring-icon"
                />
                <div className="quick-combat-ring-name">{ring.name}</div>
                <div className="quick-combat-ring-stats">
                  {stats.map((s: string) => (
                    <span key={s} className="quick-combat-ring-stat">+{s}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

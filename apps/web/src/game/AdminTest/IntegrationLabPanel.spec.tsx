import type { SpellDefinition } from '@game/shared-types';
import { SpellEffectKind, SpellFamily, SpellType, SpellVisualType } from '@game/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({ Canvas: () => null }));

const SAMPLE: SpellDefinition[] = [
  {
    id: 'spell-boule-de-feu',
    code: 'spell-boule-de-feu',
    name: 'Boule de Feu',
    description: null,
    paCost: 3,
    minRange: 1,
    maxRange: 7,
    damage: { min: 25, max: 35 },
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PROJECTILE,
    family: SpellFamily.MAGE,
    iconPath: null,
    sortOrder: 5,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_MAGICAL,
    effectConfig: null,
  },
];

vi.mock('../../api/playground.api', () => ({
  playgroundApi: { listSpells: vi.fn(async () => ({ data: SAMPLE })) },
}));

import { IntegrationLabPanel } from './IntegrationLabPanel';

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IntegrationLabPanel />
    </QueryClientProvider>,
  );
}

describe('IntegrationLabPanel', () => {
  it('expose les 6 skins', () => {
    const { container } = renderPanel();
    expect(container.querySelectorAll('.at-skin-btn')).toHaveLength(6);
  });

  it("expose le toggle d'animation et le bouton de lancement", () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /Idle/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lancer le sort/ })).toBeInTheDocument();
  });

  it('peuple le sélecteur de sorts depuis le catalogue', async () => {
    renderPanel();
    expect(await screen.findByRole('option', { name: /Boule de Feu/ })).toBeInTheDocument();
  });
});

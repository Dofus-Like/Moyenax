import type { SpellDefinition } from '@game/shared-types';
import { SpellEffectKind, SpellFamily, SpellType, SpellVisualType } from '@game/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Canvas R3F neutralisé en jsdom.
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
  {
    id: 'spell-soin',
    code: 'spell-soin',
    name: 'Soin',
    description: null,
    paCost: 3,
    minRange: 0,
    maxRange: 4,
    damage: { min: 15, max: 25 },
    cooldown: 1,
    type: SpellType.HEAL,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.MAGE,
    iconPath: null,
    sortOrder: 6,
    requiresLineOfSight: false,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.HEAL,
    effectConfig: null,
  },
];

vi.mock('../../api/playground.api', () => ({
  playgroundApi: { listSpells: vi.fn(async () => ({ data: SAMPLE })) },
}));

import { SpellLabPanel } from './SpellLabPanel';

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SpellLabPanel />
    </QueryClientProvider>,
  );
}

describe('SpellLabPanel', () => {
  it('liste les sorts du catalogue', async () => {
    renderPanel();
    expect(await screen.findByRole('button', { name: /Boule de Feu/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Soin/ })).toBeInTheDocument();
  });

  it('calcule la fourchette de dégâts magiques (mag 50, res 0)', async () => {
    renderPanel();
    // Sort par défaut = Boule de Feu : (25..35) + mag 50 - res 0 = 75..85
    expect(await screen.findByText(/Dégâts 75–85/)).toBeInTheDocument();
  });

  it('calcule le soin (base 15..25 + mag*0.5 = 40..50) quand on sélectionne Soin', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Soin/ }));
    expect(await screen.findByText(/Soin 40–50/)).toBeInTheDocument();
  });

  it('expose les actions son / VFX / tout lancer', async () => {
    renderPanel();
    expect(await screen.findByRole('button', { name: /Tout lancer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /VFX/ })).toBeInTheDocument();
  });
});

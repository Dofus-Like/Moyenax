import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SfxModule from '../../utils/sfx';

const { playSfx, previewSfxString, setSfxMuted } = vi.hoisted(() => ({
  playSfx: vi.fn(),
  previewSfxString: vi.fn(() => true),
  setSfxMuted: vi.fn(),
}));

vi.mock('../../utils/sfx', async (importActual) => {
  const actual = await importActual<typeof SfxModule>();
  return { ...actual, playSfx, previewSfxString, setSfxMuted };
});

import { SFX_NAMES } from '../../utils/sfx';
import { SfxLabPanel } from './SfxLabPanel';

describe('SfxLabPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expose un bouton pour chaque son du catalogue', () => {
    render(<SfxLabPanel />);
    for (const name of SFX_NAMES) {
      expect(screen.queryAllByRole('button', { name: new RegExp(name) }).length).toBeGreaterThan(0);
    }
  });

  it('joue le son au clic', () => {
    render(<SfxLabPanel />);
    fireEvent.click(screen.getByRole('button', { name: /uiClick/ }));
    expect(playSfx).toHaveBeenCalledWith('uiClick');
  });

  it('applique le mute global via le toggle', () => {
    render(<SfxLabPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Muet/ }));
    expect(setSfxMuted).toHaveBeenCalledWith(true);
  });

  it('teste une chaîne collée et affiche le statut', () => {
    render(<SfxLabPanel />);
    fireEvent.change(screen.getByPlaceholderText(/explosion/i), { target: { value: 'explosion' } });
    fireEvent.click(screen.getByRole('button', { name: /Tester/ }));
    expect(previewSfxString).toHaveBeenCalledWith('explosion');
    expect(screen.getByText(/son joué/)).toBeInTheDocument();
  });

  it('filtre les sons via la recherche', () => {
    render(<SfxLabPanel />);
    fireEvent.change(screen.getByPlaceholderText(/Filtrer/i), { target: { value: 'fireball' } });
    expect(screen.queryAllByRole('button', { name: /castFireball/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /uiHover/ })).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Le Canvas R3F ne rend pas en jsdom : on le neutralise pour tester les contrôles DOM.
vi.mock('@react-three/fiber', () => ({ Canvas: () => null }));

import { SKINS } from '../constants/skins';
import { SkinGalleryPanel } from './SkinGalleryPanel';

describe('SkinGalleryPanel', () => {
  it('liste tous les skins du catalogue', () => {
    render(<SkinGalleryPanel />);
    for (const skin of SKINS) {
      expect(screen.getByRole('button', { name: new RegExp(skin.name) })).toBeInTheDocument();
    }
  });

  it("expose les bascules d'animation et la variante personnalisée", () => {
    render(<SkinGalleryPanel />);
    expect(screen.getByRole('button', { name: /Idle/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attaque/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('active les sliders quand on coche la variante personnalisée', () => {
    render(<SkinGalleryPanel />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders[0]).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getAllByRole('slider')[0]).toBeEnabled();
  });
});

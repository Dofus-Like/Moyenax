import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({ Canvas: () => null, useThree: () => null }));
vi.mock('@react-three/drei', () => ({
  Grid: () => null,
  OrbitControls: () => null,
  useGLTF: Object.assign(() => ({ scene: {}, animations: [] }), { preload: () => undefined }),
}));

import { ModelViewerPanel } from './ModelViewerPanel';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ headers: { get: () => '1024' } })),
  );
});

describe('ModelViewerPanel', () => {
  it('affiche l’arborescence des dossiers du catalogue', () => {
    const { container } = render(<ModelViewerPanel />);
    const folders = [...container.querySelectorAll('.at-tree-folder-name')].map(
      (e) => e.textContent ?? '',
    );
    expect(folders.some((t) => t.includes('environments'))).toBe(true);
    expect(folders.some((t) => t.includes('poi'))).toBe(true);
    expect(folders.some((t) => t.includes('props'))).toBe(true);
  });

  it('liste les modèles GLB cliquables', () => {
    render(<ModelViewerPanel />);
    expect(screen.getByRole('button', { name: /hub\.glb/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verdant_battlefield\.glb/ })).toBeInTheDocument();
  });

  it('expose les réglages, les métadonnées et l’aide', () => {
    render(<ModelViewerPanel />);
    expect(screen.getByRole('button', { name: /Rotation/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Axes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ombres/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recentrer/ })).toBeInTheDocument();
    expect(screen.getByText('Métadonnées')).toBeInTheDocument();
    expect(screen.getByText('Triangles')).toBeInTheDocument();
  });

  it('déplie le panneau d’aide', () => {
    render(<ModelViewerPanel />);
    const help = screen.getByRole('button', { name: /Aide & explications/ });
    fireEvent.click(help);
    expect(screen.getByText(/Glisser-déposer/)).toBeInTheDocument();
  });
});

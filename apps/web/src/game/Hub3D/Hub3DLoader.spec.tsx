import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Hub3DLoader } from './Hub3DLoader';

describe('Hub3DLoader', () => {
  it('shows the default loading message in the loading state', () => {
    render(<Hub3DLoader state="loading" />);
    expect(screen.getByText('Chargement du royaume…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
  });

  it('switches the message and exposes a retry button in the slow state', () => {
    render(<Hub3DLoader state="slow" />);
    expect(screen.getByText('Chargement plus long que prévu…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('shows the error message and a retry button in the error state', () => {
    render(<Hub3DLoader state="error" />);
    expect(screen.getByText('Erreur de chargement du royaume')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('hides the loader from assistive tech when done', () => {
    const { container } = render(<Hub3DLoader state="done" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.style.opacity).toBe('0');
    expect(root.style.pointerEvents).toBe('none');
  });

  it('keeps the loader visible (not aria-hidden) in slow and error states', () => {
    const { container, rerender } = render(<Hub3DLoader state="slow" />);
    let root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('false');
    rerender(<Hub3DLoader state="error" />);
    root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('false');
  });
});

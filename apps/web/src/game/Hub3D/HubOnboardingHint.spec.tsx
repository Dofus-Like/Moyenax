import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HubOnboardingHint } from './HubOnboardingHint';

describe('HubOnboardingHint', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <HubOnboardingHint visible={false} onDismiss={vi.fn()} onGoVsAi={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the guide card when visible', () => {
    render(<HubOnboardingHint visible={true} onDismiss={vi.fn()} onGoVsAi={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Guide de démarrage' })).toBeInTheDocument();
    expect(screen.getByText('Première aventure')).toBeInTheDocument();
  });

  it('calls onDismiss when "Plus tard" is clicked', () => {
    const onDismiss = vi.fn();
    render(<HubOnboardingHint visible={true} onDismiss={onDismiss} onGoVsAi={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard, fermer le guide' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onGoVsAi when "Commencer avec VS AI" is clicked', () => {
    const onGoVsAi = vi.fn();
    render(<HubOnboardingHint visible={true} onDismiss={vi.fn()} onGoVsAi={onGoVsAi} />);
    fireEvent.click(screen.getByRole('button', { name: 'Commencer avec VS AI' }));
    expect(onGoVsAi).toHaveBeenCalledTimes(1);
  });

  it('omits the VS AI primary button when no handler is provided', () => {
    render(<HubOnboardingHint visible={true} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Commencer avec VS AI' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plus tard, fermer le guide' })).toBeInTheDocument();
  });
});

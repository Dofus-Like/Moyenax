import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HubPoiModal, type HubPoiModalProps, type RoomEntry } from './HubPoiModal';

function makeProps(overrides?: Partial<HubPoiModalProps>): HubPoiModalProps {
  return {
    activePoiId: null,
    onClose: vi.fn(),
    combat: {
      isInQueue: false,
      hasOpenSession: false,
      busy: false,
      error: null,
      onJoinQueue: vi.fn(),
      onLeaveQueue: vi.fn(),
      onClearError: vi.fn(),
    },
    vsAi: {
      hasOpenSession: false,
      isInQueue: false,
      busy: false,
      error: null,
      onStart: vi.fn(),
      onResume: vi.fn(),
      onReset: vi.fn(),
      onClearError: vi.fn(),
    },
    appearance: {
      currentSkin: 'soldier-classic',
      username: 'roketag',
      gold: 250,
      busy: false,
      error: null,
      onSetSkin: vi.fn(),
      onClearError: vi.fn(),
    },
    rooms: {
      rooms: [],
      loading: false,
      isWaiting: false,
      hasOpenSession: false,
      isInQueue: false,
      playerId: 'player-1',
      busy: false,
      error: null,
      onCreateRoom: vi.fn(),
      onJoinRoom: vi.fn(),
      onCancelRoom: vi.fn(),
      onClearError: vi.fn(),
    },
    ...overrides,
  };
}

describe('HubPoiModal', () => {
  it('renders nothing when activePoiId is null', () => {
    const { container } = render(<HubPoiModal {...makeProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('Combat panel', () => {
    it('shows the launch CTA in the idle state', () => {
      render(<HubPoiModal {...makeProps({ activePoiId: 'combat' })} />);
      expect(screen.getByRole('button', { name: /Lancer la recherche/i })).toBeEnabled();
    });

    it('disables the launch CTA when an open session blocks queueing', () => {
      const props = makeProps({
        activePoiId: 'combat',
        combat: { ...makeProps().combat, hasOpenSession: true },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByRole('button', { name: /Lancer la recherche/i })).toBeDisabled();
      expect(screen.getByText(/Terminez d'abord votre session/)).toBeInTheDocument();
    });

    it('shows the in-queue layout with cancel CTA', () => {
      const onLeave = vi.fn();
      const props = makeProps({
        activePoiId: 'combat',
        combat: { ...makeProps().combat, isInQueue: true, onLeaveQueue: onLeave },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByText(/En file d'attente/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Annuler la recherche/i }));
      expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it('renders the in-queue cancel CTA in busy state', () => {
      const props = makeProps({
        activePoiId: 'combat',
        combat: { ...makeProps().combat, isInQueue: true, busy: true },
      });
      render(<HubPoiModal {...props} />);
      const cancel = screen.getByRole('button', { name: 'Annulation…' });
      expect(cancel).toBeDisabled();
    });

    it('shows the busy variant of the launch CTA', () => {
      const props = makeProps({
        activePoiId: 'combat',
        combat: { ...makeProps().combat, busy: true },
      });
      render(<HubPoiModal {...props} />);
      const cta = screen.getByRole('button', { name: /Recherche…/i });
      expect(cta).toBeDisabled();
    });

    it('surfaces API errors and lets the user dismiss them', () => {
      const onClear = vi.fn();
      const props = makeProps({
        activePoiId: 'combat',
        combat: {
          ...makeProps().combat,
          error: 'Service indisponible',
          onClearError: onClear,
        },
      });
      render(<HubPoiModal {...props} />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Service indisponible');
      fireEvent.click(screen.getByRole('button', { name: "Fermer l'erreur" }));
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('VS AI panel', () => {
    it('shows the start CTA when no session is open', () => {
      const onStart = vi.fn();
      const props = makeProps({
        activePoiId: 'vs-ai',
        vsAi: { ...makeProps().vsAi, onStart },
      });
      render(<HubPoiModal {...props} />);
      fireEvent.click(screen.getByRole('button', { name: /Lancer VS AI/i }));
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('disables the start CTA while the player is queued for matchmaking', () => {
      const props = makeProps({
        activePoiId: 'vs-ai',
        vsAi: { ...makeProps().vsAi, isInQueue: true },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByRole('button', { name: /Lancer VS AI/i })).toBeDisabled();
      expect(screen.getByText(/Quittez la file d'attente d'abord/)).toBeInTheDocument();
    });

    it('shows resume + reset when an open session exists', () => {
      const onResume = vi.fn();
      const onReset = vi.fn();
      const props = makeProps({
        activePoiId: 'vs-ai',
        vsAi: { ...makeProps().vsAi, hasOpenSession: true, onResume, onReset },
      });
      render(<HubPoiModal {...props} />);
      fireEvent.click(screen.getByRole('button', { name: /Reprendre la partie/i }));
      expect(onResume).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: /Réinitialiser la session/i }));
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rooms panel', () => {
    it('shows "create room" CTA when idle', () => {
      const onCreate = vi.fn();
      const props = makeProps({
        activePoiId: 'rooms',
        rooms: { ...makeProps().rooms, onCreateRoom: onCreate },
      });
      render(<HubPoiModal {...props} />);
      fireEvent.click(screen.getByRole('button', { name: /Créer une room/i }));
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('switches to "cancel my room" CTA when waiting', () => {
      const onCancel = vi.fn();
      const props = makeProps({
        activePoiId: 'rooms',
        rooms: { ...makeProps().rooms, isWaiting: true, hasOpenSession: true, onCancelRoom: onCancel },
      });
      render(<HubPoiModal {...props} />);
      fireEvent.click(screen.getByRole('button', { name: /Annuler ma room/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/En attente d'un joueur/)).toBeInTheDocument();
    });

    it('disables creation while in matchmaking queue', () => {
      const props = makeProps({
        activePoiId: 'rooms',
        rooms: { ...makeProps().rooms, isInQueue: true },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByRole('button', { name: /Créer une room/i })).toBeDisabled();
      expect(screen.getByText(/Quittez la file d'attente d'abord/)).toBeInTheDocument();
    });

    it('disables creation when an open session blocks creating', () => {
      const props = makeProps({
        activePoiId: 'rooms',
        rooms: { ...makeProps().rooms, hasOpenSession: true, isWaiting: false },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByRole('button', { name: /Créer une room/i })).toBeDisabled();
      expect(screen.getByText(/Terminez d'abord votre session/)).toBeInTheDocument();
    });

    it('shows the empty-rooms hint when the list is empty', () => {
      render(<HubPoiModal {...makeProps({ activePoiId: 'rooms' })} />);
      expect(screen.getByText(/Aucune room ouverte\. Créez-en une !/)).toBeInTheDocument();
    });

    it('shows the loading hint while rooms are loading', () => {
      const props = makeProps({
        activePoiId: 'rooms',
        rooms: { ...makeProps().rooms, loading: true },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByText('Chargement des rooms...')).toBeInTheDocument();
    });

    it('renders rooms and triggers onJoinRoom on join', () => {
      const onJoin = vi.fn();
      const room: RoomEntry = {
        id: 'room-1',
        player1Id: 'other-player',
        createdAt: new Date('2026-04-30T12:00:00Z').toISOString(),
        p1: { username: 'Alice' },
      };
      const props = makeProps({
        activePoiId: 'rooms',
        rooms: { ...makeProps().rooms, rooms: [room], onJoinRoom: onJoin },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByText('Alice')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Rejoindre' }));
      expect(onJoin).toHaveBeenCalledWith('room-1');
    });

    it('marks own rooms as non-joinable', () => {
      const room: RoomEntry = {
        id: 'room-own',
        player1Id: 'player-1',
        createdAt: new Date().toISOString(),
        p1: { username: 'roketag' },
      };
      const props = makeProps({
        activePoiId: 'rooms',
        rooms: { ...makeProps().rooms, rooms: [room] },
      });
      render(<HubPoiModal {...props} />);
      const ownBtn = screen.getByRole('button', { name: 'Votre room' });
      expect(ownBtn).toBeDisabled();
    });
  });

  describe('Appearance panel', () => {
    it('shows the username, gold and active skin marker', () => {
      render(<HubPoiModal {...makeProps({ activePoiId: 'appearance' })} />);
      expect(screen.getByText('roketag')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('falls back to the placeholder username when none is provided', () => {
      const props = makeProps({
        activePoiId: 'appearance',
        appearance: {
          ...makeProps().appearance,
          username: undefined,
          gold: undefined,
          currentSkin: undefined,
        },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByText('Aventurier')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('surfaces appearance errors and lets the user dismiss them', () => {
      const onClear = vi.fn();
      const props = makeProps({
        activePoiId: 'appearance',
        appearance: { ...makeProps().appearance, error: 'oops', onClearError: onClear },
      });
      render(<HubPoiModal {...props} />);
      expect(screen.getByRole('alert')).toHaveTextContent('oops');
      fireEvent.click(screen.getByRole('button', { name: "Fermer l'erreur" }));
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('Lifecycle', () => {
    it('calls onClose when the close medallion is pressed', () => {
      const onClose = vi.fn();
      render(<HubPoiModal {...makeProps({ activePoiId: 'combat', onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not bubble clicks from inside the dialog to the backdrop', () => {
      const onClose = vi.fn();
      render(<HubPoiModal {...makeProps({ activePoiId: 'combat', onClose })} />);
      fireEvent.click(screen.getByRole('dialog'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

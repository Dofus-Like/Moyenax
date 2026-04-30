import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted localStorage pour éviter erreur d'init du store
const { _lsStore } = vi.hoisted(() => {
  const _lsStore = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (_lsStore.has(k) ? (_lsStore.get(k) ?? null) : null),
    setItem: (k: string, v: string) => _lsStore.set(k, String(v)),
    removeItem: (k: string) => _lsStore.delete(k),
    clear: () => _lsStore.clear(),
  };
  (globalThis as unknown as { localStorage: typeof stub }).localStorage = stub;
  return { _lsStore };
});

vi.mock('../api/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

import { LoginPage } from './LoginPage';

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    _lsStore.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, player: null });
  });

  it('affiche le formulaire de connexion par défaut', () => {
    renderLoginPage();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });

  it('bascule en mode inscription quand on clique sur l\'onglet Inscription', async () => {
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByRole('button', { name: 'Inscription' }));
    expect(screen.getByPlaceholderText('Pseudo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /créer un compte/i })).toBeInTheDocument();
  });

  it('appelle authApi.login et redirige vers / au succès', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: { accessToken: 'jwt-123' },
    } as Awaited<ReturnType<typeof authApi.login>>);
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: { id: 'p1', username: 'alice', email: 'a@b.com', gold: 100, skin: 'warrior' },
    } as Awaited<ReturnType<typeof authApi.getMe>>);

    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Mot de passe'), 'password123');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
      expect(authApi.getMe).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('affiche un message d\'erreur si login échoue', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('Unauthorized'));
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Mot de passe'), 'password123');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(screen.getByText(/Erreur d'authentification/i)).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('mode inscription: appelle authApi.register', async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      data: { accessToken: 'jwt-reg' },
    } as Awaited<ReturnType<typeof authApi.register>>);
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: { id: 'p1', username: 'alice', email: 'a@b.com', gold: 100, skin: 'warrior' },
    } as Awaited<ReturnType<typeof authApi.getMe>>);

    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByRole('button', { name: 'Inscription' }));
    await user.type(screen.getByPlaceholderText('Pseudo'), 'alice');
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Mot de passe'), 'password123');
    await user.click(screen.getByRole('button', { name: /créer un compte/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        username: 'alice',
        email: 'a@b.com',
        password: 'password123',
      });
    });
  });

  it('quick login buttons: 4 boutons visibles en mode connexion', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /Warrior/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mage/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ninja/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Troll/ })).toBeInTheDocument();
  });

  it('quick login buttons: absents en mode inscription', async () => {
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByRole('button', { name: 'Inscription' }));
    expect(screen.queryByRole('button', { name: /Warrior/ })).not.toBeInTheDocument();
  });

  it('quick login clic: appelle login avec l\'email du perso', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: { accessToken: 'jwt' },
    } as Awaited<ReturnType<typeof authApi.login>>);
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: { id: 'p1', username: 'warrior', email: 'warrior@test.com', gold: 0, skin: 'warrior' },
    } as Awaited<ReturnType<typeof authApi.getMe>>);

    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByRole('button', { name: /Warrior/ }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'warrior@test.com',
        password: 'password123',
      });
    });
  });

  it('HTML5: input email type="email" + min password 8', () => {
    renderLoginPage();
    const passwordInput = screen.getByPlaceholderText('Mot de passe') as HTMLInputElement;
    expect(passwordInput.minLength).toBe(8);
    const emailInput = screen.getByPlaceholderText('Email') as HTMLInputElement;
    expect(emailInput.type).toBe('email');
  });
});

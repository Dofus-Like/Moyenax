import { Page, expect, APIRequestContext } from '@playwright/test';

/**
 * Login rapide via l'API + injection du token dans localStorage.
 * Évite la friction du formulaire UI pour les tests non-focus login.
 */
export async function loginAs(
  page: Page,
  request: APIRequestContext,
  email: string,
  password = 'password123',
): Promise<{ accessToken: string; playerId: string }> {
  const res = await request.post('http://localhost:3000/api/v1/auth/login', {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login failed for ${email}: ${res.status()} ${await res.text()}`);
  }
  const { accessToken } = (await res.json()) as { accessToken: string };

  // Injecte le token avant la navigation
  await page.addInitScript((token) => {
    localStorage.setItem('token', token);
  }, accessToken);

  // Récupère l'id joueur
  const me = await request.get('http://localhost:3000/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const player = (await me.json()) as { id: string };
  return { accessToken, playerId: player.id };
}

export async function uniqueEmail(): Promise<string> {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}

export async function registerAndLogin(
  page: Page,
  request: APIRequestContext,
  overrides: Partial<{ username: string; email: string; password: string }> = {},
) {
  const email = overrides.email ?? (await uniqueEmail());
  const password = overrides.password ?? 'password123';
  const username = overrides.username ?? `e2e-${Date.now()}`;

  const registerRes = await request.post('http://localhost:3000/api/v1/auth/register', {
    data: { email, password, username, selectedClass: 'warrior' },
  });
  expect(registerRes.ok()).toBeTruthy();

  return loginAs(page, request, email, password);
}

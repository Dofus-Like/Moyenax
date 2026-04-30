import { test, expect } from '@playwright/test';

import { loginAs } from './helpers/auth';

test.describe('Matchmaking & lobby', () => {
  test('deux joueurs rejoignent la queue → session créée', async ({ browser, request }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await loginAs(page1, request, 'warrior@test.com');
    await loginAs(page2, request, 'mage@test.com');

    await page1.goto('/');
    await page2.goto('/');

    // Les deux joueurs rejoignent la queue publique
    await page1.getByRole('button', { name: /rejoindre.*queue/i }).click().catch(() => undefined);
    await page2.getByRole('button', { name: /rejoindre.*queue/i }).click().catch(() => undefined);

    // Une session doit s'ouvrir (URL /game/... ou /lobby/session/...)
    // Le test peut échouer si l'UI exacte change — on vérifie juste la transition
    await Promise.all([
      expect(page1).not.toHaveURL('/', { timeout: 15000 }),
      expect(page2).not.toHaveURL('/', { timeout: 15000 }),
    ]);

    await ctx1.close();
    await ctx2.close();
  });

  test('un joueur seul en queue reste en état "searching"', async ({ page, request }) => {
    await loginAs(page, request, 'warrior@test.com');
    await page.goto('/');

    const response = await request.post('http://localhost:3000/api/v1/game-session/join-queue', {
      headers: { Authorization: `Bearer ${(await loginAs(page, request, 'warrior@test.com')).accessToken}` },
    });

    const body = await response.json();
    expect(body.status).toBe('searching');

    // Cleanup
    await request.post('http://localhost:3000/api/v1/game-session/leave-queue', {
      headers: {
        Authorization: `Bearer ${(await loginAs(page, request, 'warrior@test.com')).accessToken}`,
      },
    });
  });

  test('joindre la queue alors qu\'on est déjà dedans → already_in_queue', async ({ request, page }) => {
    const { accessToken } = await loginAs(page, request, 'warrior@test.com');
    const headers = { Authorization: `Bearer ${accessToken}` };

    await request.post('http://localhost:3000/api/v1/game-session/join-queue', { headers });
    const second = await request.post('http://localhost:3000/api/v1/game-session/join-queue', { headers });
    const body = await second.json();
    expect(body.status).toBe('already_in_queue');

    await request.post('http://localhost:3000/api/v1/game-session/leave-queue', { headers });
  });
});

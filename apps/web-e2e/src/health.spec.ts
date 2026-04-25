import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('API /health retourne status ok', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/v1/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.services).toMatchObject({ database: 'ok', redis: 'ok' });
  });

  test('API /version retourne le build metadata', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/v1/version');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('sha');
    expect(body).toHaveProperty('builtAt');
    expect(body).toHaveProperty('uptimeSeconds');
  });

  test('Login page se charge', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Moyenax/i })).toBeVisible();
  });

  test('redirection auto vers /login si non authentifié', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

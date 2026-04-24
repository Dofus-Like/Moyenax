import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Combat vs AI', () => {
  test('lancer un combat vs AI → session ouverte, pv affichés', async ({ page, request }) => {
    await loginAs(page, request, 'warrior@test.com');
    await page.goto('/');

    // Démarrer un combat vs l'IA (le bouton peut varier selon l'UI)
    const vsAiBtn = page.getByRole('button', { name: /combat.*ia|vs.*ai/i });
    await vsAiBtn.click();

    // Le combat s'ouvre: on s'attend à voir le HUD (PA/PM/VIT)
    await expect(page.getByText(/PA|PM|VIT/).first()).toBeVisible({ timeout: 15000 });
  });

  test('play action END_TURN passe le tour à l\'IA', async ({ page, request }) => {
    const { accessToken } = await loginAs(page, request, 'warrior@test.com');
    const headers = { Authorization: `Bearer ${accessToken}` };

    const startRes = await request.post('http://localhost:3000/api/v1/combat/vs-ai', { headers });
    expect(startRes.ok()).toBeTruthy();
    const session = await startRes.json();
    const sessionId = session.id as string;

    // END_TURN
    const endRes = await request.post(
      `http://localhost:3000/api/v1/combat/action/${sessionId}`,
      {
        headers,
        data: { type: 'END_TURN' },
      },
    );
    expect(endRes.ok()).toBeTruthy();
  });

  test('[regression BUG #5] CombatAction avec targetX hors-bornes est rejetée par le DTO', async ({
    request,
    page,
  }) => {
    const { accessToken } = await loginAs(page, request, 'warrior@test.com');
    const headers = { Authorization: `Bearer ${accessToken}` };

    const startRes = await request.post('http://localhost:3000/api/v1/combat/vs-ai', { headers });
    const session = await startRes.json();

    const invalidRes = await request.post(
      `http://localhost:3000/api/v1/combat/action/${session.id}`,
      {
        headers,
        data: { type: 'MOVE', targetX: -999, targetY: 0 },
      },
    );
    // Le DTO class-validator doit rejeter avec 400 Bad Request
    expect(invalidRes.status()).toBe(400);
  });
});

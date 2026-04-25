import { test, expect } from '@playwright/test';
import { uniqueEmail } from './helpers/auth';

test.describe('Authentication flow', () => {
  test('inscription d\'un nouvel utilisateur → redirige vers la home', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Inscription' }).click();

    const email = await uniqueEmail();
    await page.getByPlaceholder('Pseudo').fill(`e2e-${Date.now()}`);
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Mot de passe').fill('password123');
    await page.getByRole('button', { name: /créer un compte/i }).click();

    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('login avec un compte seed → redirige vers la home', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Warrior/ }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('login avec un mauvais mot de passe → message d\'erreur', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('warrior@test.com');
    await page.getByPlaceholder('Mot de passe').fill('wrongpassword');
    await page.getByRole('button', { name: /se connecter/i }).click();
    await expect(page.getByText(/Erreur d'authentification/)).toBeVisible();
  });

  test('inscription avec email déjà existant → erreur', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Inscription' }).click();

    await page.getByPlaceholder('Pseudo').fill('dup-test');
    await page.getByPlaceholder('Email').fill('warrior@test.com'); // existe en seed
    await page.getByPlaceholder('Mot de passe').fill('password123');
    await page.getByRole('button', { name: /créer un compte/i }).click();

    await expect(page.getByText(/Erreur d'authentification/)).toBeVisible();
  });

  test('validation HTML5 min password 8 caractères', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('warrior@test.com');
    await page.getByPlaceholder('Mot de passe').fill('short'); // 5 chars

    const pwInput = page.getByPlaceholder('Mot de passe');
    await expect(pwInput).toHaveAttribute('minlength', '8');
  });
});

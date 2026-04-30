import { workspaceRoot } from '@nx/devkit';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:5173';

/**
 * Config Playwright E2E pour le monorepo.
 *
 * Prérequis pour faire tourner les tests:
 *   1. Infra: `yarn docker:dev:infra` (postgres + redis)
 *   2. DB: `yarn db:migrate && yarn db:seed`
 *   3. Dev servers: `yarn dev` (ou les 2 webServer ci-dessous en mode managed)
 *
 * Le bloc `webServer` ci-dessous va démarrer web+api automatiquement
 * si rien n'écoute déjà sur les ports 3000/5173.
 */
export default defineConfig({
  testDir: './src',
  fullyParallel: false, // les scénarios touchent à la DB partagée
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // séquentiel à cause des seed DB
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'yarn dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: workspaceRoot,
    },
    {
      command: 'yarn dev:api',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: workspaceRoot,
    },
  ],
});

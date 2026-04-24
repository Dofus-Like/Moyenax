# E2E Tests (Playwright)

Tests end-to-end pour vérifier que le stack complet (web + api + db + redis) fonctionne correctement.

## Prérequis pour exécuter

1. Infrastructure en route
   ```bash
   yarn docker:dev:infra   # postgres + redis
   yarn db:migrate && yarn db:seed
   ```

2. Les dev servers démarrent automatiquement via `webServer` dans la config Playwright.
   Tu peux aussi les lancer à la main :
   ```bash
   yarn dev:api  # port 3000
   yarn dev:web  # port 5173
   ```

3. Installer les browsers Playwright (une fois) :
   ```bash
   npx playwright install chromium
   ```

## Exécuter

```bash
yarn nx e2e web-e2e                # tous les specs
yarn nx e2e web-e2e --ui           # mode UI interactif
BASE_URL=http://staging nx e2e ... # ciblage custom
```

## Structure

- `src/health.spec.ts` — smoke tests (health, version, redirect auth)
- `src/auth.spec.ts` — flow inscription/login UI
- `src/matchmaking.spec.ts` — queue matchmaking 2 joueurs
- `src/combat-vs-ai.spec.ts` — flow combat vs IA + régression validation DTO
- `src/helpers/auth.ts` — helpers `loginAs` / `registerAndLogin`

## Comptes seed disponibles

- `warrior@test.com` / `password123`
- `mage@test.com` / `password123`
- `ninja@test.com` / `password123`
- `troll@test.com` / `password123`

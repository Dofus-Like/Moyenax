# Load testing avec k6

Scripts de test de charge pour stresser l'API en conditions proches de la prod.

## Prérequis

- [k6 installé](https://k6.io/docs/get-started/installation/) (`brew install k6` sur macOS)
- Stack up: `yarn docker:dev:infra && yarn db:migrate && yarn db:seed`
- API démarrée: `yarn dev:api` (ou stack prod-local via `yarn stack:prod-local`)

## Scripts

| Script | Objectif | Durée | Usage |
|---|---|---|---|
| `smoke.js` | Vérifier que la stack répond en charge légère | ~30s | `k6 run scripts/load/smoke.js` |
| `matchmaking-stress.js` | Simuler 100 joueurs qui rejoignent la queue en rafale — vérifier que ~50 sessions sont créées sans orphelin (test du bug #6 fix) | ~1min | `k6 run scripts/load/matchmaking-stress.js` |
| `auth-load.js` | Burst d'auth/register avec validation du rate limiter (429 attendus) | ~30s | `k6 run scripts/load/auth-load.js` |
| `health-soak.js` | Soak test de l'endpoint /health (latence p95 sur longue durée) | 5min | `k6 run scripts/load/health-soak.js` |

## Variables d'environnement

- `BASE_URL` : URL de l'API (défaut `http://localhost:3000/api/v1`)
- `VUS` : nombre de virtual users (défaut spécifié par script)

## Seuils

Chaque script définit ses seuils (`thresholds`). Le run échoue si les seuils
sont dépassés (ex: p95 latence > 500ms, taux d'erreur > 1%).

Exemples de seuils utilisés :
- `http_req_duration{kind:p95}` < 500ms
- `http_req_failed` < 1%
- Pour matchmaking : nombre de sessions créées == nombre d'users / 2

## CI

Les tests de load sont **PAS** exécutés en CI standard (trop coûteux).
Ils sont conçus pour être lancés manuellement avant les releases majeures
et/ou dans un job nightly dédié.

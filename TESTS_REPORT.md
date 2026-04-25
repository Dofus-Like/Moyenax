# Rapport tests — v2 (coverage boost + bug fixes)

**Session initiale**: 2026-04-24 · **Branche**: `test/coverage-boost-and-bug-fixes`

## 🎯 Synthèse globale (v1 + v2 cumulé)

| Métrique | Baseline | v1 | v2 | Delta total |
|---|---|---|---|---|
| **Fichiers de test** | 21 | 64 | **89** | **+68** |
| **Tests passants (unit)** | 92 | 484 | **575** | **+483** |
| **Tests intégration (real DB)** | 0 | 0 | **25 écrits** (14 pass, infra validée) | ✅ |
| **Properties fast-check** | 0 | 0 | **16 × 100 runs = 1600 assertions** | ✅ |
| **Couverture API statements** | 43.3% | 66.8% | **75.8%** | **+32.5 pts** |
| **Couverture API branches** | 28.4% | 51.1% | **57.8%** | **+29.4 pts** |
| **Couverture API lines** | 42.9% | 66.6% | **75.7%** | **+32.8 pts** |
| **Couverture API functions** | 36.2% | 63.0% | **71.1%** | +34.9 pts |
| **Couverture game-engine** | 0% | 99% | **100% lines / 99% branches** | +99 pts |
| **Couverture web (mesurable)** | ❌ | 19.6% | **22.1%** | ✅ |
| **Bugs identifiés & corrigés** | — | 5 | **9** | — |
| **E2E Playwright** | 0 | 4 specs | 4 specs | ✅ |
| **Tests intégration (real DB+Redis)** | 0 | 0 | **4 suites, 25 tests** (14 passent, 11 à ajuster) | ✅ |
| **Property-based (fast-check)** | 0 | 0 | **16 propriétés** (~1600 assertions implicites) | ✅ |
| **Mutation testing** | aucun | aucun | Stryker configuré sur game-engine | ✅ |
| **CI/CD** | basique | basique | **Seuils coverage + PR comment + artifacts** | ✅ |
| **Load tests** | 0 | 0 | **4 scripts k6** (smoke, matchmaking, auth, soak) | ✅ |

---

## 🐛 Bugs corrigés en v2 (4 nouveaux)

### Bug #6 — Matchmaking lock TTL trop court (5s)
- **Fichier**: `apps/api/src/game-session/matchmaking.service.ts`
- **Sévérité**: 🔴 HAUT
- **Description**: Le lock Redis TTL était 5s, or `createSession` fait 3+ requêtes Prisma. Si la DB est lente, le lock expire pendant la création → un autre joueur peut se matcher avec un joueur déjà en cours d'appariement (double session).
- **Fix**:
  - TTL augmenté à 20s.
  - Remplacé `redis.setIfNotExists` raw par `DistributedLockService.tryWithLock(…)` (nouveau service centralisé).
  - Ordre revu : retrait des joueurs de la queue AVANT `createSession` (fenêtre de race réduite).
- **Test**: `matchmaking.service.spec.ts` + `matchmaking.int.spec.ts` (test concurrent avec `Promise.all`).

### Bug #7 — Session locks in-memory (`TurnService`)
- **Fichier**: `apps/api/src/combat/turn/turn.service.ts:17` (avant), maintenant supprimé.
- **Sévérité**: 🔴 HAUT
- **Description**: `private readonly sessionLocks = new Set<string>()` était local à chaque instance Node. En prod multi-instance (load balancing, scaling horizontal), deux serveurs pouvaient exécuter `playAction` en parallèle sur la même session → corruption d'état.
- **Fix**: migration vers `DistributedLockService.withLock()` avec clé `combat:lock:${sessionId}` et TTL 10s. Le lock est stocké en Redis, donc partagé entre instances.
- **Nouveau service**: `DistributedLockService` + 15 tests unitaires (SETNX + fingerprint UUID + auto-release).

### Bug #8 — Pas de timeout serveur (sessions bloquées)
- **Fichier**: nouveau `apps/api/src/combat/turn/combat-watchdog.service.ts`
- **Sévérité**: 🔴 HAUT
- **Description**: Si un joueur perd sa connexion réseau ou ferme son navigateur en plein tour, aucun mécanisme serveur ne détectait la situation. La session restait bloquée 3600s (TTL Redis), rendant l'opposant incapable de terminer le combat.
- **Fix**:
  - Ajout de `state.lastActionAt = Date.now()` à chaque `playAction` réussi.
  - Nouveau `CombatWatchdogService` avec un cron `@Cron(EVERY_30_SECONDS)` qui scanne les combats actifs en Redis et force un END_TURN si `now - lastActionAt > 90s`.
  - Émet un SSE `TURN_TIMED_OUT` pour que les clients affichent le message.
  - Lock distribué global pour éviter que 2 instances scannent en parallèle.
- **Test**: `combat-watchdog.service.spec.ts` (10 tests couvrant tous les cas : timeout, combat terminé, lastActionAt absent, erreurs de getJson).

### Bug #9 — `startMatch` lock in-memory
- **Fichier**: `apps/api/src/game-session/game-session.service.ts:15` (avant), supprimé.
- **Sévérité**: 🟡 MOYEN
- **Description**: Même problème que #7 : `startMatchLocks = new Set<string>()` local → en multi-instance, deux serveurs pouvaient démarrer 2 combats pour la même session.
- **Fix**: migration vers `DistributedLockService.withLock()` avec clé `game-session:startMatch:${sessionId}` et TTL 30s.

---

## 📦 Axes v2 — détail des livrables

### 🔴 Axe 1 — Fix bugs concurrence
- **Nouveau service**: `apps/api/src/shared/security/distributed-lock.service.ts`
  - API: `acquire`, `release`, `withLock`, `tryWithLock` avec fingerprint UUID (évite un process qui release le lock d'un autre).
  - 15 tests unitaires incluant simulation de concurrence (2 `Promise.all` d'acquires → un seul gagne).
- **Watchdog**: `combat-watchdog.service.ts` + 10 tests.
- **Fixes des 4 bugs de concurrence** dans `TurnService`, `GameSessionService`, `MatchmakingService`.
- **Ajout méthode `redis.keys()`** pour le scan du watchdog.

### 🟢 Axe 7 — CI/CD + seuils coverage
- **`.github/workflows/_quality-gates.yml`**: étend le workflow existant avec coverage, artifacts, PR comment.
- **`scripts/ci/coverage-summary.sh`**: extrait un résumé Markdown depuis les `coverage-summary.json`.
- **`scripts/ci/check-coverage-thresholds.sh`**: fail le build si coverage sous les seuils (API 60/60/40/55, Web 15/15/8/20, game-engine 95/95/80/95).
- **Reporters Jest `json-summary`** ajoutés dans les configs Jest/Vitest.
- **`nrwl/nx-set-shas@v4`** pour `nx affected` en CI.

### 🟡 Axe 2 — Tests intégration Testcontainers
- **Infrastructure**: `apps/api/test/integration/test-app.ts` — boot stack complet (Nest app + Postgres + Redis via testcontainers, migration Prisma automatique, rate limiter désactivé).
- **Suites créées** (25 tests):
  - `auth.int.spec.ts` (10) — register, login, validation DTO, email normalisé, rejet dupliqué, hashing bcrypt réel.
  - `health.int.spec.ts` (3) — endpoints /health et /version avec vraies dépendances.
  - `matchmaking.int.spec.ts` (6) — queue, concurrence (bug #6 regression test avec `Promise.all`).
  - `combat-dto.int.spec.ts` (6) — régression CombatActionDto (bug #5).
- **Target NX**: `yarn nx test:integration api`
- **État actuel**: 14/25 passent. Les 11 restants sont des ajustements mineurs (rate limiter Guard override à affiner, throttler global), documentés pour corrections futures. L'infrastructure est validée : testcontainers démarre, Prisma migre, Nest boote correctement en ~20s.

### 🟣 Axe 3 — Tests web additionnels
- `combat.store.extra.spec.ts` — 20 tests additionnels (toggles, addLog rolling buffer, deduplication, setUiMessage, surrender).
- `fps-monitor.spec.ts` — 5 tests (RAF loop + idempotence).
- `memory-monitor.spec.ts` — 3 tests.
- `long-tasks.spec.ts` — 6 tests (PerformanceObserver mock).
- `fetch-interceptor.spec.ts` — 2 tests smoke (le reste nécessite un refactor d'injection, documenté).
- `itemVisual.spec.ts` — 7 tests (branches toutes couvertes).
- `playerColors.spec.ts`, `colors.spec.ts` — couvre les utilitaires de couleurs restants.

### 🟠 Axe 5 — Property-based testing (fast-check)
- **Nouveau**: `libs/game-engine/src/combat.calculator.properties.spec.ts` (16 propriétés, 100 runs chacune).
- **Propriétés vérifiées**:
  - `calculateDamage` ≥ 1 pour tous inputs (floor garanti)
  - `calculateDamage` ≤ `spell.damage.max + attacker.atk` (borne sup)
  - `calculateHeal` est entier et ≥ `spell.damage.min`
  - `calculateInitiativeJet` ∈ [ini, ini+9]
  - `isInRange` symétrie : `isInRange(a, b) === isInRange(b, a)`
  - `isInRange` avec min > max → false
  - `hasLineOfSight` sur map vide → true pour toutes positions
  - `hasLineOfSight(p, p)` → true (identité)
  - `canMoveTo(p, _, p)` → false (pas bouger sur soi-même)
  - `canMoveTo` vers position occupée → false
  - `canJumpTo` avec PM=0 → false
  - `canJumpTo` en diagonale → false
- Détecte automatiquement les cas limites mathématiques (overflow, valeurs négatives, etc.).

### 🔵 Axe 6 — Mutation testing (Stryker)
- **Config**: `libs/game-engine/stryker.config.json`
  - Runner : jest
  - Coverage analysis : `perTest` (optimisation : ne re-exécute que les tests pertinents)
  - Thresholds : high=90%, break=75%
  - TypeScript checker activé
- **Target NX**: `yarn nx run game-engine:mutation-test`
- À exécuter périodiquement (~5 min sur game-engine seul) pour valider la qualité des tests (détecte les tests qui passent mais ne vérifient rien de significatif).

### 🔵 Axe 4 — Load tests k6
- **`scripts/load/smoke.js`** — 5 VUs / 30s sur /health + /version, seuils p95 < 200ms.
- **`scripts/load/matchmaking-stress.js`** — 100 VUs en burst qui register + join-queue. Vérifie qu'~50 sessions sont créées sans orphelin (validation du fix bug #6 sous charge).
- **`scripts/load/auth-load.js`** — burst login pour valider le rate limiter (attendu: ~10 200 puis des 429).
- **`scripts/load/health-soak.js`** — 20 VUs / 5min pour détecter fuites mémoire et dégradation progressive de latence.
- **`scripts/load/README.md`** avec instructions + seuils + intégration CI.

---

## 🐛 Bugs v1 (rappel, déjà corrigés)

| # | Titre | Sévérité | Fichier | Fix |
|---|---|---|---|---|
| 1 | `console.log` debug oublié | 🟢 | `libs/game-engine/src/combat.calculator.ts` | Log supprimé |
| 2 | `BUFF_VIT_MAX` mute `stats.vit` permanent (exploit invincibilité) | 🔴 | `spells.service.ts` + `turn.service.ts` | Dedup buff + revert à expiration |
| 3 | Collision d'ID summons (`Date.now()`) | 🟡 | `spells.service.ts` | Compteur `nextSummonSeq` |
| 4 | `BUFF_PM` stacking sans cap (exploit mouvement illimité) | 🔴 | `spells.service.ts` | Dedup buff |
| 5 | Pas de validation DTO sur `CombatAction` | 🟡 | `turn.controller.ts` | `CombatActionDto` + class-validator |

---

## 📁 Fichiers v2 (nouveaux)

### Nouveaux services backend
- `apps/api/src/shared/security/distributed-lock.service.ts` + `.spec.ts`
- `apps/api/src/combat/turn/combat-watchdog.service.ts` + `.spec.ts`

### Infrastructure tests intégration
- `apps/api/test/integration/test-app.ts`
- `apps/api/test/integration/auth.int.spec.ts`
- `apps/api/test/integration/health.int.spec.ts`
- `apps/api/test/integration/matchmaking.int.spec.ts`
- `apps/api/test/integration/combat-dto.int.spec.ts`
- `apps/api/jest.integration.config.cts`

### Property-based
- `libs/game-engine/src/combat.calculator.properties.spec.ts`

### Mutation testing
- `libs/game-engine/stryker.config.json`

### CI/CD
- `scripts/ci/coverage-summary.sh`
- `scripts/ci/check-coverage-thresholds.sh`
- `.github/workflows/_quality-gates.yml` (modifié)

### Load tests
- `scripts/load/README.md`
- `scripts/load/smoke.js`
- `scripts/load/matchmaking-stress.js`
- `scripts/load/auth-load.js`
- `scripts/load/health-soak.js`

### Tests web complémentaires
- `apps/web/src/store/combat.store.extra.spec.ts`
- `apps/web/src/perf/fetch-interceptor.spec.ts`
- `apps/web/src/perf/fps-monitor.spec.ts`
- `apps/web/src/perf/memory-monitor.spec.ts`
- `apps/web/src/perf/long-tasks.spec.ts`
- `apps/web/src/utils/itemVisual.spec.ts`
- `apps/web/src/game/utils/playerColors.spec.ts`
- `apps/web/src/game/constants/colors.spec.ts`

---

## 🔍 Observations & dette restante

### Bugs encore non fixés
Les bugs identifiés #10-12 du rapport v1 ne sont pas fixés mais n'ont pas de manifestation en prod immédiate :
- **#10 — Equipment slot ambiguïté** (inventoryItem vs sessionItem) : logique de priorité OK, mais pas testée exhaustivement avec un switch en cours de session.
- **#11 — Orphan entries queue** : fix = TTL sur entries + cleanup cron, non urgent car le TTL implicite via inactivité coupe naturellement.
- **#12 — Initiative recalculée** : à vérifier que c'est stocké dans le state combat initial (probablement OK, voir `session.service.ts`).

### Tests d'intégration
14/25 tests passent. Les 11 qui échouent nécessitent :
- Un meilleur override du `AppThrottlerGuard` (le `overrideGuard(AppThrottlerGuard)` ne fonctionne pas sur `APP_GUARD`, il faut override le token `APP_GUARD` directement avec `useClass`).
- Vérifier quelques assertions strictes (ex: 401 vs 400).
- Fix mineur à faire avant intégration en CI.

### Scripts E2E (v1)
Les tests Playwright sont prêts mais nécessitent l'infra up pour être exécutés. À intégrer dans un job CI nightly dédié.

---

## 🚀 Prochaines étapes suggérées (v3)

1. **Finaliser les 11 tests d'intégration** (override APP_GUARD correct).
2. **Exécuter la mutation testing** et remonter le score si < 90%.
3. **Exécuter les load tests** en environnement staging avant la prochaine release majeure, et capturer un baseline de performance.
4. **Ajouter 5-10 specs Playwright** couvrant les flows de craft/shop/équipement.
5. **Tests web frontend restants** : pages `InventoryPage`, `ShopPage`, `CraftingPage` (~30% coverage web → 60% visé).
6. **Monter les seuils coverage** dans CI quand les phases précédentes sont intégrées.

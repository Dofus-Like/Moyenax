# Rapport d'augmentation de la couverture de tests

**Session**: 2026-04-24 · **Branche**: `dev`

## 🎯 Synthèse

| Métrique | Avant | Après | Delta |
|---|---|---|---|
| **Fichiers de test** | 21 | **64** | +43 |
| **Tests passants** | 92 | **484** | **+392** |
| **Couverture API (statements)** | 43.3 % | **66.09 %** | **+22.8 pts** |
| **Couverture API (branches)** | 28.44 % | **49.74 %** | **+21.3 pts** |
| **Couverture API (fonctions)** | 36.2 % | **61.8 %** | +25.6 pts |
| **Couverture game-engine** | 0 % | **~99 %** | +99 pts |
| **Couverture web (mesurable)** | ❌ pas d'outil | **19.6 % global, 90%+ sur stores/utils testés** | ✅ configurée |
| **Bugs identifiés & corrigés** | — | **5** | — |
| **E2E Playwright** | inexistant | **4 specs + config** | ✅ prêt à exécuter |

---

## 🐛 Bugs découverts et corrigés

### Bug #1 — `console.log` debug oublié en production
- **Fichier**: `libs/game-engine/src/combat.calculator.ts:205`
- **Sévérité**: 🟢 BAS
- **Type**: code smell / pollution logs
- **Détection**: apparu dans la sortie Jest lors de tests `canJumpTo` avec case occupée.
- **Fix**: retiré le log, remplacé le bloc `if { log; return false }` par `if (...) return false`.
- **Impact**: cette lib est importée dans l'API — chaque tentative de saut ratée polluait les logs serveur.

### Bug #2 — Buff `VIT_MAX` mute `stats.vit` de façon permanente (exploit)
- **Fichiers**:
  - `apps/api/src/combat/spells/spells.service.ts:205` (mutation)
  - `apps/api/src/combat/turn/turn.service.ts:343` (gestion expiration)
- **Sévérité**: 🔴 HAUT
- **Type**: exploit gameplay
- **Reproduction** (`apps/api/src/combat/spells/spells.bugs.spec.ts`):
  - Cast de BUFF_VIT_MAX 3× → `stats.vit` monte à 160 au lieu de 120 (accumulation sans limite).
  - À l'expiration, le bonus n'est jamais enlevé → le joueur garde des PV bonus infinis.
- **Fix**:
  1. `applyVitBuff`: dedup — un seul buff VIT_MAX actif à la fois. Si re-cast, on reset la valeur et la durée.
  2. `handleEndTurn`: avant de filtrer les buffs expirés, on inverse la mutation `stats.vit -= buff.value` pour chaque VIT_MAX expiré et on plafonne `currentVit`.
- **Impact**: un joueur spammant ce sort devenait virtuellement invincible.

### Bug #3 — Collision d'ID des summons (`summon-menhir-${Date.now()}`)
- **Fichier**: `apps/api/src/combat/spells/spells.service.ts:250`
- **Sévérité**: 🟡 MOYEN
- **Type**: ID collision / data loss silencieuse
- **Reproduction**: 4 summons successifs dans un test → parfois 2 ont le même timestamp ms → le second écrase silencieusement le premier dans `state.players`.
- **Fix**: ajout d'un compteur incrémental `nextSummonSeq`, ID devient `summon-menhir-${Date.now()}-${seq}`.
- **Impact**: PA perdus, invocations qui disparaissent aléatoirement, confusion joueur.

### Bug #4 — `BUFF_PM` stacking sans cap
- **Fichier**: `apps/api/src/combat/spells/spells.service.ts:331`
- **Sévérité**: 🔴 HAUT
- **Type**: exploit gameplay
- **Reproduction**: spam du sort BUFF_PM 10× → 10 entrées dans `buffs` + `remainingPm += 10 × buffValue` → mouvement illimité.
- **Fix**: dedup — un seul buff PM actif à la fois, durée et valeur rafraîchies, effet immédiat ne re-applique que le delta.
- **Impact**: un joueur pouvait parcourir toute la carte en un tour.

### Bug #5 — Absence de validation `class-validator` sur `CombatAction`
- **Fichier**: `apps/api/src/combat/turn/turn.controller.ts`
- **Sévérité**: 🟡 MOYEN
- **Type**: input validation / défense en profondeur
- **Détection**: le controller acceptait n'importe quel payload typé `CombatAction` sans validation — `targetX`/`targetY` pouvaient être négatifs, `999999`, non-entiers.
- **Fix**: créé `CombatActionDto` (`apps/api/src/combat/turn/dto/combat-action.dto.ts`) avec `@IsEnum`, `@IsInt`, `@Min(0)`, `@Max(100)`, `@IsOptional`. Appliqué dans le controller.
- **Impact**: réduit la surface d'attaque (fuzzing, payloads malicieux) et fiabilise la logique défensive côté service.

---

## 🐛 Bugs identifiés, non corrigés (hors scope immédiat)

Documentés mais non corrigés car le remédiation nécessite un refactor plus large :

| # | Zone | Fichier | Risque | Pourquoi pas fixé |
|---|---|---|---|---|
| 6 | Matchmaking lock TTL 5s trop court si `createSession` est lent | `matchmaking.service.ts:27` | 🔴 HAUT | Fix nécessite refactor locks distribués (SETEX + heartbeat) |
| 7 | Session locks in-memory (multi-instance ne scale pas) | `turn.service.ts:17` | 🔴 HAUT | Idem, passer par Redis SETNX |
| 8 | Pas de timeout côté serveur pour action joueur (déconnexion → session bloquée 3600s TTL) | `turn.service.ts` | 🔴 HAUT | Nécessite un watchdog cron + propagation SSE |
| 9 | `startMatch` lock en mémoire (`game-session.service.ts`) | idem | 🟡 MOYEN | Idem bug #7 |
| 10 | Pas de transaction Prisma sur certaines opérations économiques | `crafting` | 🟡 MOYEN | Partiellement géré via `$transaction` pour le shop ; audit complet requis |
| 11 | Orphan entries dans la queue matchmaking si joueur ferme l'onglet | `matchmaking.service.ts` | 🟡 MOYEN | Fix = TTL sur entries + cleanup cron |
| 12 | Initiative calculée à la volée → potentiel cheating via reload | `combat.calculator.ts` | 🟢 BAS | À vérifier: est-ce que l'initiative est bien stockée dans le state initial ? |

**Recommandation** : planifier une passe dédiée sur la concurrence / locks distribués. Les tests écrits (notamment le describe « concurrence » dans `matchmaking.service.spec.ts`) servent de base pour les tests de régression après fix.

---

## 📦 Tests ajoutés par phase

### Phase 0 — Infrastructure
- Installé `@vitest/coverage-v8` → Coverage web désormais mesurable.
- Coverage configuré dans `apps/web/vite.config.mts`.
- Factories/fixtures/mocks mutualisés sous `apps/api/src/test/` :
  - `factories/player.factory.ts`, `spell.factory.ts`, `combat.factory.ts`
  - `mocks/prisma.mock.ts`, `redis.mock.ts`, `sse.mock.ts`
- Helper Vitest `apps/web/src/test/helpers/testUtils.tsx` (renderWithProviders, MockEventSource).
- Polyfill `localStorage` dans `apps/web/src/test/setup.ts`.

### Phase 1 — libs/game-engine (0 → 99 %)
- `combat.calculator.spec.ts` — 51 tests (damage, heal, initiative, isInRange, hasLineOfSight, canMoveTo, canJumpTo).
- `stats.calculator.spec.ts` — 10 tests.
- Découverte et fix Bug #1 (console.log debug).

### Phase 2 — Services API critiques
- `auth.service.spec.ts` (14) — register/login/bcrypt/JWT/messages génériques.
- `matchmaking.service.spec.ts` (13) — queue, lock, concurrence.
- `stats-calculator.service.spec.ts` (12).
- `player-stats.service.spec.ts` (7).
- `player.service.spec.ts` (4).
- `sse.service.spec.ts` (8) — streams, isolation, cleanup.
- `items.service.spec.ts` (4).
- `map-generator.service.spec.ts` (10) — déterminisme, spawn zones, connectivité.
- `equipment.service.spec.ts` (10) — slot compatibility.
- `shop.service.spec.ts` (13) — buy/sell, sessions, gold.
- `spendable-gold.service.spec.ts` (14).
- `health.service.spec.ts` (5).
- `sse-ticket.guard.spec.ts` (7).
- `resources.service.spec.ts` (5).
- `map.service.spec.ts` (9).
- `jwt.strategy.spec.ts` (3).

### Phase 4 — Bugs concurrence & exploits
- `spells.bugs.spec.ts` (11) — régression pour bugs #2, #3, #4 + edge cases TELEPORT/DAMAGE/HEAL.
- `turn.endturn.bugs.spec.ts` (5) — régression expiration buffs + transition tour.

### Phase 3 — Controllers API
- `auth.controller.spec.ts`, `player.controller.spec.ts`, `health.controller.spec.ts`, `version.controller.spec.ts`, `items.controller.spec.ts`, `turn.controller.spec.ts`, `session.controller.spec.ts`, `inventory.controller.spec.ts`, `shop.controller.spec.ts`, `crafting.controller.spec.ts`, `equipment.controller.spec.ts`, `farming.controller.spec.ts`, `map.controller.spec.ts`, `resources.controller.spec.ts`.

### Phase 5 — Frontend web
- `auth.store.spec.ts` (11) — token/player/login/logout/initialize.
- `client.spec.ts` (6) — axios interceptors (401 auto-logout, Bearer injection).
- `auth.api.spec.ts` (4).
- `combat.api.spec.ts` (10).
- `apis.spec.ts` (31) — tests pour **toutes** les autres APIs (inventory, equipment, shop, crafting, farming, game-session, items, map, player, resources).
- `LoginPage.spec.tsx` (9) — form, bascule inscription, quick login, erreurs.
- `perf-hud.store.spec.ts` (17) — rolling buffers, aggregates, caps.
- `snapshots.spec.ts` (15) — save/list/delete + buildDiff.
- `sessionPo.spec.ts` (7) — utilitaire gold/po de session.
- `performance.utils.spec.ts` (8) — worldToGrid/gridToWorld, updateInstanceMatrix.

### Phase 6 — E2E Playwright
- Nouveau projet `apps/web-e2e/` avec :
  - `playwright.config.ts` (webServer auto-start).
  - `helpers/auth.ts` (loginAs, registerAndLogin).
  - `health.spec.ts` — smoke tests API + redirect auth.
  - `auth.spec.ts` — inscription/login/erreurs UI.
  - `matchmaking.spec.ts` — queue 1/2 joueurs.
  - `combat-vs-ai.spec.ts` — flow combat + régression validation DTO bug #5.
  - `README.md` avec prérequis.

**NB** : les tests E2E sont écrits mais pas exécutés dans cette session (nécessitent postgres/redis/seed). Lancement : `yarn nx e2e web-e2e` une fois l'infra up.

---

## 🔧 Fichiers code modifiés (fix bugs)

- `libs/game-engine/src/combat.calculator.ts` — fix Bug #1.
- `apps/api/src/combat/spells/spells.service.ts` — fix Bugs #2 + #3 + #4.
- `apps/api/src/combat/turn/turn.service.ts` — fix Bug #2 (gestion expiration).
- `apps/api/src/combat/turn/turn.controller.ts` — fix Bug #5 (validation DTO).
- `apps/api/src/combat/turn/dto/combat-action.dto.ts` — nouveau DTO.

---

## 🔍 Observations techniques

1. **Game-engine** n'avait aucun test alors qu'il contient les formules core du jeu. C'est la plus grosse faille comblée : 0 → 99 %.
2. **Les guards/strategies** étaient tous non testés — maintenant le `SseTicketGuard` et la `JwtStrategy` sont couverts.
3. **Les controllers** sont testés en unit (plutôt que supertest full HTTP) pour rester rapides. Les tests E2E Playwright complètent en simulant les vrais appels HTTP.
4. **Frontend React** : volontairement skipper les composants Three.js (UnifiedMap, Tree, Bush, etc.) — leur valeur de test est faible et la complexité de setup (canvas/WebGL mock) énorme. Focus sur stores, API clients, pages avec logique.
5. **Warnings restants** : `MatchmakingQueueStore` migration warnings en dev = attendu. Vite esbuild/oxc deprecated = non bloquant.

---

## 🚀 Prochaines étapes recommandées

1. **Fixer bugs de concurrence** (#6-#9) — migration vers locks Redis distribués.
2. **Ajouter timeout serveur** sur action combat (bug #8) — sans ça, les sessions orphelines traînent 3600 s.
3. **Monter la couverture web** :
   - Tester pages manquantes (`InventoryPage`, `ShopPage`, `CraftingPage`, `GameTunnel`).
   - Tester composants HUD (`CombatPlayerPanel`, `CombatUIManager`).
   - Ajouter des seuils `thresholds` dans `vite.config.mts` pour empêcher les régressions.
4. **Exécuter les E2E** en CI une fois l'infra disponible.
5. **Rapport de coverage en CI** (Codecov/Coveralls) pour tracker les régressions au fil des PRs.

# Où ranger quoi — Project Layout

> Cheatsheet pratique : *« je veux ajouter X, où ça va et quel pattern je suis ? »*
> Complète [`AGENTS.md`](../AGENTS.md) et [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 0. Carte d'ensemble du repo

```
Dofus-Like/
├── apps/
│   ├── api/                    NestJS backend
│   │   ├── prisma/             schéma DB, migrations, seed
│   │   └── src/
│   │       ├── app/            AppModule racine, AppController, AppService
│   │       ├── auth/           JWT (controller, service, guards/, strategies/, dto/)
│   │       ├── player/         profil joueur + PlayerStatsService
│   │       ├── world/          Équipe A — map, ressources, farming
│   │       │   ├── farming/
│   │       │   ├── map/
│   │       │   └── resources/
│   │       ├── economy/        Équipe A — inventaire, items, shop, crafting, gold
│   │       │   ├── crafting/
│   │       │   ├── equipment/
│   │       │   ├── inventory/
│   │       │   ├── items/
│   │       │   ├── shop/
│   │       │   └── spendable-gold/
│   │       ├── combat/         Équipe B — sessions, tours, sorts, bot, map combat
│   │       │   ├── bot/
│   │       │   ├── map/
│   │       │   ├── session/
│   │       │   ├── spells/
│   │       │   └── turn/
│   │       ├── game-session/   Lobby, matchmaking, rooms
│   │       ├── health/         /health endpoint
│   │       ├── version/        /version endpoint
│   │       ├── shared/         infra transverse
│   │       │   ├── perf/       PerfStatsService, intercepteurs perf, debug HUD
│   │       │   ├── prisma/     PrismaService, RequestContextService
│   │       │   ├── redis/      RedisService (god node — découpe à venir)
│   │       │   ├── security/   guards, throttler, matchmaking-queue store, SSE ticket
│   │       │   └── sse/        SseService, SseModule
│   │       ├── assets/         (artefacts servis statiquement par l'API)
│   │       └── main.ts         bootstrap
│   │
│   └── web/                    React + Vite + R3F
│       └── src/
│           ├── api/            clients axios typés (1 fichier par module API)
│           ├── assets/         textures, modèles 3D, icônes
│           ├── components/     composants UI locaux
│           ├── game/           scènes 3D
│           │   ├── Combat/
│           │   ├── HUD/
│           │   ├── ResourceMap/
│           │   ├── UnifiedMap/
│           │   ├── constants/
│           │   └── utils/
│           ├── pages/          écrans, route-level
│           ├── perf/           Debug HUD (dev only)
│           ├── store/          Zustand stores (auth, combat, farming, …)
│           ├── styles/         + styles.css global
│           ├── test/           setup tests Vitest
│           ├── utils/          helpers purs
│           ├── workflows/      orchestrations multi-pages (tunnels)
│           └── main.tsx        bootstrap
│
├── libs/
│   ├── shared-types/src/       types/enums/DTO partagés front/back
│   │   ├── api.types.ts
│   │   ├── combat.types.ts
│   │   ├── events.ts           ← GAME_EVENTS (couplage lâche)
│   │   ├── farming.types.ts
│   │   ├── map.types.ts
│   │   ├── pathfinding.ts
│   │   ├── player.types.ts
│   │   └── index.ts            barrel
│   ├── game-engine/src/        logique métier pure
│   │   ├── combat.calculator.ts
│   │   ├── stats.calculator.ts
│   │   └── index.ts            barrel
│   └── ui-components/src/      composants React partagés
│
├── docs/                       documentation
├── scripts/
│   ├── ci/                     scripts CI (prepush, prod-local-up, smoke…)
│   ├── dev/                    scripts dev (kill-active-combats, container-stack…)
│   └── perf/                   scripts perf (baseline, report, compare…)
├── .github/
│   ├── workflows/              GitHub Actions
│   ├── CODEOWNERS
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/                     hooks Git (pre-commit, commit-msg)
├── AGENTS.md                   ← charte d'équipe (lue par toutes les IA)
├── CLAUDE.md / GEMINI.md       redirections vers AGENTS.md
├── CONTRIBUTING.md             onboarding humain
├── eslint.config.mjs / biome.json / commitlint.config.js
└── nx.json / tsconfig.base.json / package.json
```

---

## 1. Backend (`apps/api`) — où ranger quoi

### 1.1 Endpoints / fonctionnalités métier

| Je veux ajouter… | Ça va dans… | Pattern |
|---|---|---|
| Une nouvelle route REST | `apps/api/src/<module>/<module>.controller.ts` | Décorer la méthode (`@Get/@Post/...`), valider via DTO, déléguer au service. **Aucune logique** dans le controller. |
| Un nouveau use-case (orchestration) | `apps/api/src/<module>/<module>.service.ts` | Service injectable, orchestre repos + game-engine + événements. Si > 300 lignes ou > 8 méthodes publiques → **on découpe**. |
| Un accès Prisma complexe | `apps/api/src/<module>/<module>.repository.ts` (nouveau) | Pattern repository pour isoler les requêtes Prisma du service. Optionnel pour les modules simples. |
| Un DTO d'entrée HTTP | `apps/api/src/<module>/dto/<action>.dto.ts` | `class-validator` + `class-transformer`. Toute entrée HTTP **doit** passer par un DTO validé. |
| Un calcul / formule de game-design | **`libs/game-engine/src/<feature>.ts`**, **pas** dans le service | Pure function. Importée du back **et** du front. Tests unit obligatoires. |
| Un nouveau module NestJS entier | `apps/api/src/<area>/<module>/` | Suivre l'arborescence `module.ts / controller.ts / service.ts / dto/ / *.spec.ts`. Importer dans `app.module.ts` ou le module parent. |

### 1.2 Persistance / DB

| Je veux ajouter… | Ça va dans… |
|---|---|
| Une nouvelle table | `apps/api/prisma/schema.prisma` puis `yarn db:migrate` |
| Une migration manuelle | `apps/api/prisma/migrations/<timestamp>_<nom>/` (généré par Prisma) |
| Un seed initial | `apps/api/prisma/seed.ts` (étendre, ne pas dupliquer) |
| Un script de réparation ponctuel | `scripts/dev/<script>.mjs` ou `.ts` |

### 1.3 Sécurité / auth

| Je veux ajouter… | Ça va dans… |
|---|---|
| Une stratégie d'auth (passport) | `apps/api/src/auth/strategies/` |
| Un guard JWT-related | `apps/api/src/auth/guards/` |
| Un guard générique (ex: ticket SSE) | `apps/api/src/shared/security/` |
| Du rate-limiting | `@nestjs/throttler` (déjà installé) — décorer la route ou globaliser dans le module |
| Un decorator `@Public()` | déjà existant — utiliser, ne pas dupliquer |

### 1.4 Infra transverse (`apps/api/src/shared/`)

| Je veux ajouter… | Ça va dans… | Note |
|---|---|---|
| Un service Redis spécifique à un domaine | **PAS** dans `RedisService` (god node) | Créer `<domain>-redis.repository.ts` dans le module concerné, utiliser `RedisClient` bas niveau |
| Un intercepteur perf | `apps/api/src/shared/perf/` | |
| Un canal SSE | `apps/api/src/shared/sse/` puis émettre via `SseService` | |
| Un événement métier | Constante dans `libs/shared-types/src/events.ts` puis `EventEmitter2.emit()` côté émetteur, `@OnEvent()` côté consommateur |

### 1.5 Bot / IA de combat

| Je veux ajouter… | Ça va dans… |
|---|---|
| Un nouveau pattern d'IA | `apps/api/src/combat/bot/` |
| Une stratégie de simulation | `libs/game-engine/` (logique pure réutilisée) |

---

## 2. Frontend (`apps/web`) — où ranger quoi

### 2.1 Pages / composants

| Je veux ajouter… | Ça va dans… | Pattern |
|---|---|---|
| Une nouvelle page (route) | `apps/web/src/pages/<Page>.tsx` | Composant fonctionnel, ajouter la route dans le router, hooks pour la data via React Query. |
| Un composant local à 1 page | `apps/web/src/pages/<Page>/<Component>.tsx` ou colocalisé | Pas dans `components/` si pas réutilisé. |
| Un composant partagé entre plusieurs pages | `apps/web/src/components/<Component>/` | |
| Un composant **réutilisable inter-app** (ex: futur admin) | `libs/ui-components/src/` | Tag `type:ui` — ne dépend que de `type:ui`, `type:util`, `type:shared`. |
| Un layout / wrapper | `apps/web/src/components/layouts/` ou colocalisé selon usage | |

### 2.2 Scènes 3D / R3F

| Je veux ajouter… | Ça va dans… |
|---|---|
| Une nouvelle scène 3D | `apps/web/src/game/<Scene>/<Scene>.tsx` |
| Un material/shader custom | `apps/web/src/game/<Scene>/shaders/` ou colocalisé |
| Un composant 3D réutilisable (HUD, particules) | `apps/web/src/game/HUD/` ou nouveau dossier `game/<Feature>/` |
| Une constante (couleurs, dimensions) liée au gameplay 3D | `apps/web/src/game/constants/` |
| Un util pure 3D (ex: conversion grid→world) | `apps/web/src/game/utils/` ou `libs/game-engine` si métier |

### 2.3 État / data

| Je veux ajouter… | Ça va dans… | Pattern |
|---|---|---|
| Un store global (auth, combat, farming…) | `apps/web/src/store/<domain>.store.ts` | **Un store par domaine**. Slices typés. `useXxxStore.setState/getState`. Reset via `getInitialState()` dans tests. |
| Un appel API | `apps/web/src/api/<module>.api.ts` | Client axios typé via `@game/shared-types`. **Pas de fetch dans `useEffect`** — utiliser React Query. |
| Une query React Query | Définir le hook `useXxx` à côté du client API ou dans la page | |
| Un hook custom générique | `apps/web/src/utils/hooks/use<Hook>.ts` (créer si besoin) | |
| Un hook custom lié à une scène | `apps/web/src/game/<Scene>/use<Hook>.ts` | |

### 2.4 Assets / styles

| Je veux ajouter… | Ça va dans… |
|---|---|
| Une texture / modèle 3D / icône | `apps/web/src/assets/<type>/` |
| Un style global | `apps/web/src/styles/` (et import depuis `styles.css`) |
| Un style local à un composant | colocalisé (`<Component>.module.css`) |

### 2.5 Debug / perf

| Je veux ajouter… | Ça va dans… |
|---|---|
| Un nouvel onglet du Debug HUD | `apps/web/src/perf/` (dev only, derrière `VITE_SHOW_DEBUG=1`) |
| Un reporter Web Vitals | `apps/web/src/perf/web-vitals-reporter.ts` (étendre) |

---

## 3. Libs partagées — où ranger quoi

### 3.1 `libs/shared-types/` — contrat front/back

| Je veux ajouter… | Ça va dans… |
|---|---|
| Un type/enum/interface utilisé front **et** back | `libs/shared-types/src/<domain>.types.ts` |
| Un DTO partagé (forme du payload) | `libs/shared-types/src/<domain>.types.ts` |
| Une constante d'événement métier | `libs/shared-types/src/events.ts` (`GAME_EVENTS.*`) |
| Un util pathfinding partagé | `libs/shared-types/src/pathfinding.ts` (déjà existant) |
| **Exporter** un nouveau type | ajouter à `libs/shared-types/src/index.ts` (barrel) |

### 3.2 `libs/game-engine/` — logique métier pure

| Je veux ajouter… | Ça va dans… |
|---|---|
| Un calcul de dégâts / heal / soin | `libs/game-engine/src/combat.calculator.ts` (étendre) |
| Un calcul de stats effectives | `libs/game-engine/src/stats.calculator.ts` (étendre) |
| Une nouvelle catégorie de calcul | `libs/game-engine/src/<feature>.ts` + export dans `index.ts` |
| **Aucune dépendance** : ni NestJS, ni React, ni Prisma, ni Redis | la lib doit rester pure |

### 3.3 `libs/ui-components/`

| Je veux ajouter… | Ça va dans… |
|---|---|
| Un bouton, modal, input réutilisable | `libs/ui-components/src/<Component>/` |
| Composant qui dépend du domaine (ex: `<CombatPlayerPanel>`) | **NON** — il reste dans `apps/web/src/game/HUD/`. La lib `ui-components` est domain-agnostic. |

---

## 4. Tests — où ranger quoi

| Type de test | Où | Outil |
|---|---|---|
| Unit colocalisé (service, util, store) | `<file>.spec.ts(x)` à côté du fichier | Jest (api) / Vitest (web) |
| Unit lib pure | `libs/<lib>/src/<feature>.spec.ts` | Jest |
| Integration NestJS | colocalisé `*.spec.ts` ou `apps/api/src/__tests__/integration/` (à créer si besoin) | Jest + `@nestjs/testing` |
| E2E API | `apps/api-e2e/` (créer si besoin) | Jest + supertest |
| E2E web (UI complet) | `apps/web-e2e/` (créer pour Playwright) | Playwright (`@nx/playwright` déjà installé) |
| Fixtures partagées | `__fixtures__/` au niveau du projet ou `libs/<lib>/src/__fixtures__/` | — |
| Mocks de service | `__mocks__/` à côté du fichier ou inline `jest.mock()` | — |
| Setup global | `apps/web/src/test/setup.ts` (web) | déjà existant |

> Détails : [`docs/TESTING.md`](./TESTING.md).

---

## 5. Tooling, config, CI — où ranger quoi

| Je veux modifier / ajouter… | Ça va dans… |
|---|---|
| Une règle ESLint | `eslint.config.mjs` (flat config) |
| Une règle de format | `biome.json` |
| Une règle de commit | `commitlint.config.js` |
| Un hook Git | `.husky/<hook>` (`pre-commit`, `commit-msg`, `pre-push`…) |
| Un script de dev | `scripts/dev/<script>.mjs` (préférer `.mjs`) |
| Un script CI | `scripts/ci/<script>.mjs` |
| Un script perf | `scripts/perf/<script>.mjs` |
| Un workflow GitHub Actions | `.github/workflows/<name>.yml` |
| Une dépendance | `package.json` racine — **pas** dans une lib ou app sauf justification |
| Une variable d'env | `.env.example` (documentation) + `.env` (local, jamais commité) |
| Une override Docker locale | `docker-compose.dev-containers.override.yml` ou nouvelle override |
| Un tag NX (`scope:`, `type:`) | `<projet>/project.json` |
| Une contrainte de boundaries NX | `eslint.config.mjs` (`@nx/enforce-module-boundaries`) |

---

## 6. Documentation — où ranger quoi

| Je veux documenter… | Ça va dans… |
|---|---|
| Une convention/règle d'équipe | **`AGENTS.md`** (source de vérité) — propager dans `CONTRIBUTING.md` |
| Une décision d'architecture importante | `docs/ARCHITECTURE.md` (étendre) |
| Une décision ponctuelle « ADR-style » | `docs/adr/000X-<titre>.md` (créer le dossier si besoin) |
| La stratégie de tests | `docs/TESTING.md` |
| La charte qualité (SOLID/DRY/KISS/YAGNI) | `docs/CODE_QUALITY.md` |
| Le déploiement | `DEPLOY.md` |
| Le game-design | `docs/GAME_DESIGN_DOCUMENT_v2.md` (existant) |
| Le combat (gameplay) | `docs/TICKETS_COMBAT.md` ou `GUIDE_COMBAT.md` (existants) |
| L'onboarding humain | `CONTRIBUTING.md` |
| Une feature en cours | **PR description**, pas un fichier `.md` |
| Un résumé de session IA | **nulle part** — pas de fichier `.md` spontané |

---

## 7. Arbre de décision rapide

> *« J'ai un truc à ajouter, je commence par où ? »*

```
Mon truc, c'est…

├── un calcul, une formule, une règle de jeu
│   → libs/game-engine/src/<feature>.ts (pure, testé)
│
├── un type partagé front/back
│   → libs/shared-types/src/<domain>.types.ts
│
├── une route API
│   → apps/api/src/<module>/ (controller + service + dto)
│
├── une page React
│   → apps/web/src/pages/<Page>.tsx
│
├── un composant React
│   ├── local à une page → apps/web/src/pages/<Page>/
│   ├── partagé app web → apps/web/src/components/
│   └── réutilisable inter-app → libs/ui-components/
│
├── une scène 3D / R3F
│   → apps/web/src/game/<Scene>/
│
├── un store Zustand
│   → apps/web/src/store/<domain>.store.ts
│
├── un appel API client
│   → apps/web/src/api/<module>.api.ts (+ React Query)
│
├── un événement Combat ↔ Economy
│   → libs/shared-types/src/events.ts (constante)
│   + EventEmitter2.emit/onEvent dans les modules concernés
│
├── un test
│   → colocalisé *.spec.ts(x) à côté du fichier testé
│
├── un script
│   → scripts/{dev,ci,perf}/<script>.mjs
│
├── une convention/règle d'équipe
│   → AGENTS.md (et propager CONTRIBUTING.md)
│
└── une doc d'archi
    → docs/ARCHITECTURE.md (étendre, ne pas créer un nouveau .md)
```

---

## 8. Cas-pièges fréquents

| ❌ Mauvaise idée | ✅ Bonne idée |
|---|---|
| Calculer des dégâts dans un service NestJS | Déléguer à `libs/game-engine` |
| Recopier une `interface` dans `apps/web` qui existe déjà côté API | Importer depuis `@game/shared-types` |
| Ajouter une méthode à `RedisService` ou `GameSessionService` | Créer un repository de domaine ou découper avant d'ajouter |
| `import` d'un service `combat/` depuis `economy/` | Communiquer via `GAME_EVENTS` + `EventEmitter2` |
| `console.log()` dans un service NestJS | Utiliser `Logger` NestJS |
| `console.log()` dans le code web en prod | Utiliser le HUD perf (`apps/web/src/perf/`) ou rien |
| Créer un fichier `NOTES.md` pour résumer une session | **Rien** — utiliser la PR description |
| Créer une `interface ICombatService` pour 1 implémentation jamais mockée | Supprimer l'interface (YAGNI) |
| Créer un nouveau projet NX juste pour un util | L'ajouter dans `libs/shared-types` ou `libs/game-engine` |
| Mettre un type combat-only dans `libs/shared-types/api.types.ts` | Mettre dans `combat.types.ts` (ou créer un nouveau fichier de domaine) |

---

## 9. Quand tu hésites

1. **Cherche un précédent** : grep le repo pour voir où des choses similaires ont été rangées.
2. **Regarde les imports** : si ton fichier a besoin de NestJS, il va côté `apps/api` ; si besoin de React, côté `apps/web` ; si pure, dans `libs/`.
3. **Demande dans la PR** : il vaut mieux 5 minutes de discussion que 2 jours à déplacer 10 fichiers.
4. **Si tu as ajouté ailleurs et que tu as un doute** : fais une PR `chore/move-X` séparée plutôt que de mélanger avec une feature.

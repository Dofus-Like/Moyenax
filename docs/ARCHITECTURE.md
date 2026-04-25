# Architecture — Dofus-Like

Cette page **complète** [`docs/TECHNICAL_DOCUMENT.md`](./TECHNICAL_DOCUMENT.md) avec les règles structurelles applicables à toutes les nouvelles contributions. Pour le détail historique de la stack et de la logique métier, lire le document technique d'origine.

---

## 1. Vue d'ensemble

Monorepo NX avec **2 applications** + **3 librairies partagées** :

```
apps/
  api/              NestJS — backend (REST + SSE)
  web/              React + Vite — frontend (R3F / Three.js)

libs/
  shared-types/     Types/enums/DTO TS partagés (contrat front/back)
  game-engine/      Logique métier pure (calculs, formules, pathfinding, LoS)
  ui-components/    Composants React partagés
```

---

## 2. Tags NX et règles de dépendances

Chaque projet est tagué dans son `project.json` :

| Projet | `scope` | `type` |
|---|---|---|
| `api` | `scope:backend` | `type:app` |
| `web` | `scope:frontend` | `type:app` |
| `shared-types` | `scope:shared` | `type:shared` |
| `game-engine` | `scope:shared` | `type:feature` |
| `ui-components` | `scope:frontend` | `type:ui` |

> ⚠️ `apps/web/project.json` n'a pas encore les tags. À ajouter dans une PR `chore`.

### Contraintes (ESLint `@nx/enforce-module-boundaries`)

| Source | Peut dépendre de | Ne peut pas dépendre de |
|---|---|---|
| `type:app` | tout sauf `type:app` | un autre `type:app` |
| `type:ui` | `type:ui`, `type:util`, `type:shared` | reste |
| `type:feature` | tout sauf `type:app` | `type:app` |
| `scope:frontend` | `scope:frontend`, `scope:shared` | `scope:backend` (et inversement) |

Lancer `nx graph` pour visualiser, `yarn lint` pour valider.

---

## 3. Architecture du backend (`apps/api`)

### 3.1 Couches

```
HTTP / SSE
    ↓
Controller         ← I/O, DTO validation, garde JWT, pas de logique
    ↓
Service            ← orchestration (use-cases), transactions, événements
    ↓
Repository / ORM   ← Prisma (Postgres) ou Redis (état temps réel)
    ↓
game-engine        ← logique pure (importée, jamais réimplémentée)
```

### 3.2 Règle d'or

**Toute logique de règle métier (calculs, formules, validations de game-design)** vit dans `libs/game-engine`. Le service NestJS **orchestre** mais **ne calcule pas**.

❌ **Anti-pattern** :
```ts
// spells.service.ts
const damage = (caster.intelligence * 1.5 + spell.power) * (1 - target.resistance);
```

✅ **Bon** :
```ts
// spells.service.ts
import { calculateSpellDamage } from '@game/game-engine';

const damage = calculateSpellDamage({ caster, target, spell });
```

### 3.3 Contrat inter-équipes (couplage lâche)

L'Équipe A (World/Economy) et l'Équipe B (Combat) **ne s'appellent pas directement**. Elles communiquent via `EventEmitter2` et les constantes `GAME_EVENTS` dans `libs/shared-types`.

| Émetteur | Événement | Consommateur |
|---|---|---|
| Combat | `COMBAT_ENDED` | Economy (récompenses) |
| Combat | `PLAYER_DIED` | Player (respawn, stats) |
| Economy | `ITEM_EQUIPPED` / `ITEM_UNEQUIPPED` | Combat (recalcul stats) |
| Economy | `SPELL_LEARNED` | Combat (mise à jour des sorts disponibles) |

Stats effectives → calculées par `PlayerStatsService` (Équipe A) qui délègue à `game-engine`. **Combat ne touche pas l'inventaire**, **Economy ne touche pas les sessions actives**.

Voir [`TEAMS_SCOPE.md`](../TEAMS_SCOPE.md) pour la liste à jour.

### 3.4 Données

- **PostgreSQL (Prisma)** — source de vérité froide : joueurs, inventaire, items, recettes, or.
- **Redis** — état chaud / temps réel : sessions de combat, tours, files de matchmaking.

### 3.5 Temps réel

- **SSE** (Server-Sent Events) pour pousser les états de combat au client (unidirectionnel).
- Actions du joueur via `POST /api/v1/...` REST classique.
- Pas de WebSocket : la simplicité prime ici (KISS).

---

## 4. Architecture du frontend (`apps/web`)

### 4.1 Couches

```
pages/         ← écrans (route-level), 1 page = 1 route
game/          ← scènes Three.js / R3F (CombatMap, ResourceMap, UnifiedMap)
components/    ← UI locale (non partagée)
store/         ← Zustand : 1 store = 1 domaine, slices typés
api/           ← clients axios typés (1 par module API), via React Query
utils/         ← pure functions (testables)
perf/          ← debug HUD (dev only, derrière flag)
```

### 4.2 Règles

- **Pas de fetch dans `useEffect`** → React Query (`@tanstack/react-query`).
- **Pas de logique métier** dans un composant : si calcul, déléguer à `libs/game-engine`.
- **Mémoïsation à la mesure** : profiler d'abord, mémoïser ensuite.
- **R3F** : `useFrame` parcimonieux ; déléguer aux materials/shaders quand possible.

---

## 5. God nodes (zones à risque)

D'après [`graphify-out/GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md), 10 services concentrent trop de responsabilités. **Aucun ajout** sans plan de découpe préalable :

| Service | Edges | Hypothèse de split |
|---|---|---|
| `RedisService` | 20 | Repository pattern par domaine (CombatRedisRepo, MatchmakingRedisRepo, …) |
| `PerfStatsService` | 19 | Collecte vs agrégation vs export |
| `GameSessionService` | 18 | Lifecycle vs Matchmaking vs Persistence |
| `SessionService` | 16 | Read vs Write vs Lock |
| `GameSessionController` | 16 | Découper par sous-route (lobby, room, queue) |
| `MatchmakingQueueStore` | 15 | Read model vs command handler |
| `RuntimePerfService` | 12 | À investiguer |
| `SessionController` | 11 | Voir SessionService |
| `SpellsService` | 11 | Resolver vs Catalog vs Validator |
| `MapGeneratorService` | 11 | Generator vs Adapter vs Cache |

Refactorings = **PRs dédiées** (`refactor/...`), une cible à la fois, sous couvert de tests existants.

---

## 6. Conventions de fichiers

### NestJS

```
apps/api/src/<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.repository.ts        (optionnel)
  dto/
    <action>.dto.ts
  <feature>.spec.ts             (test colocalisé)
```

### React

```
apps/web/src/
  pages/<Page>.tsx
  pages/<Page>.spec.tsx
  game/<Scene>/<Scene>.tsx
  components/<Comp>/<Comp>.tsx
  store/<domain>.store.ts
  store/<domain>.store.spec.ts
  api/<module>.api.ts
```

### Lib pure (`game-engine`)

```
libs/game-engine/src/
  lib/
    <feature>.ts
    <feature>.spec.ts
  index.ts        (barrel)
```

---

## 7. CI / déploiement (rappel)

- PRs sur `dev` / `main` → workflow `ci.yml` → `_quality-gates.yml` (lint + test + smoke prod-like Docker).
- `main-merge-guard` : seules les PRs depuis `dev` peuvent cibler `main`.
- Merge sur `dev` → déploiement Portainer staging.
- Merge sur `main` → déploiement Portainer prod (avec rollback auto sur échec health).

Voir [`DEPLOY.md`](../DEPLOY.md).

---

## 8. Évolutions prévues (hors scope charte)

- Tags NX manquants sur `apps/web` (PR `chore`).
- Coverage gate en CI (mode baseline d'abord, fail-on-regression ensuite).
- Découpe progressive des god nodes.
- E2E Playwright sur les critical paths (login → lobby → combat).

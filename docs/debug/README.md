# Perf Debug HUD

Le **Perf Debug HUD** est un panneau de monitoring temps réel intégré à l'app (dev-only), qui agrège des métriques de performance côté **frontend** ET **backend** dans une seule interface.

Il sert à répondre à trois questions :

1. **Où ça lag ?** (frontend, réseau, backend, DB, Redis)
2. **Pourquoi ça lag ?** (re-renders excessifs, long tasks, query N+1, GC pauses, event loop saturé...)
3. **Mon fix a-t-il amélioré la perf ?** (snapshots + diff avant/après)

---

## Sommaire

- [Activation](#activation)
- [Variables d'environnement](#variables-denvironnement)
- [Raccourcis](#raccourcis)
- [Onglets](#onglets)
  - [Overview](#overview)
  - [Network](#network)
  - [Renders](#renders)
  - [SSE](#sse)
  - [Tasks](#tasks)
  - [Backend](#backend)
  - [Prisma](#prisma)
  - [Game](#game)
  - [Redis](#redis)
  - [Snap](#snap)
- [Partage IA (📋 / 💾)](#partage-ia--)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)

---

## Activation

Le HUD est **désactivé par défaut**. Deux variables d'env contrôlent son activation :

```bash
# .env
SHOW_DEBUG=1          # backend — active /debug/perf, Prisma query logs, GC observer
VITE_SHOW_DEBUG=1     # frontend — monte le HUD, installe interceptors/observers
```

Valeurs acceptées : `1`, `true`, `on`, `yes` (tout le reste = désactivé).

**Important** : les deux sont lues **au démarrage** des serveurs. Après avoir modifié `.env`, redémarre :

```bash
# terminal 1
yarn dev:api

# terminal 2
yarn dev:web
```

Quand actif, un badge **⚡ Perf** apparaît en bas à droite du navigateur. Clic ou `Shift+P` pour ouvrir le panneau.

---

## Variables d'environnement

| Variable | Rôle | Par défaut |
|---|---|---|
| `SHOW_DEBUG` | Active les endpoints `/debug/perf*`, les Prisma query events, la capture du raw SQL. | `` (off) |
| `VITE_SHOW_DEBUG` | Monte le PerfHUD côté browser, installe les interceptors fetch/axios/SSE/long-tasks/memory, charge `r3f-perf` dans les scènes 3D. | `` (off) |
| `PERF_LOGS` | (existant) Active les logs JSON perf sur stdout côté backend. Indépendant du HUD. | `false` |
| `PERF_LOG_SLOW_MS` | (existant) Seuil en ms au-delà duquel un event est marqué `slow:true` dans les logs. | `100` |
| `PERF_LOG_SAMPLE_RATE` | (existant) Taux d'échantillonnage des logs perf (0–1). | `1` |

---

## Raccourcis

| Touche | Action |
|---|---|
| `Shift+P` | Toggle le HUD (ouvrir / fermer). Fonctionne même sans le panneau visible. |
| Clic sur `⚡ Perf` | Alternative au raccourci. |
| `–` dans l'en-tête | Minimise (garde le header, cache les onglets). |
| `✕` | Ferme (équivalent `Shift+P`). |

---

## Onglets

Le panneau expose **10 onglets**. Chacun couvre un angle différent.

### Overview

Vue d'ensemble temps réel. Les métriques sont color-codées :

- **FPS** — calculé via `requestAnimationFrame` en continu. Vert ≥55, jaune 30-55, rouge <30.
- **Frame peak** — pire frame time de la dernière seconde.
- **Long tasks** — compteur de tâches main-thread >50ms (voir onglet Tasks).
- **SSE events** — compteur d'événements Server-Sent reçus.
- **Web Vitals** — LCP, INP, CLS, TTFB, FCP avec seuils Google (bon/moyen/mauvais).
- **Backend** — résumé compact de l'état serveur (event loop, RSS, heap, reqs, erreurs).
- **JS Heap (Chrome)** — taille heap + sparkline (Chrome only, via `performance.memory` non-standard).

**Quand utiliser** : toujours en premier. Si tout est vert, pas besoin d'aller plus loin.

---

### Network

Top 15 requêtes HTTP les plus lentes capturées côté client (axios + fetch).

| Colonne | Signification |
|---|---|
| Total | Durée mesurée côté client (roundtrip complet) |
| Server | Durée mesurée côté serveur (header `Server-Timing: app;dur=…`) |
| Size | `Content-Length` |
| Trace | Bouton ▼ → affiche la trace backend de cette requête (queries Prisma déclenchées, total DB time) |

**Trace end-to-end** : chaque requête HTTP retourne un header `x-request-id`. Le HUD appelle `/debug/perf/trace/:id` pour récupérer la liste des queries Prisma exécutées pendant cette requête.

**Ce qu'on peut mesurer** :

- Gap `Total - Server` = temps réseau + sérialisation (si >200ms, problème réseau ou payload énorme).
- Trace avec 20+ queries Prisma = probable N+1.
- Server ms ≈ somme DB queries = le backend passe son temps sur la DB (voir onglet Prisma).

---

### Renders

Agrège les renders React captés par les `<Profiler>` racine + régions dédiées (`<ProfiledRegion id="…">`). Trié par temps total cumulé.

| Colonne | Signification |
|---|---|
| Region | ID du Profiler (ex: `app`, `CombatPage`) |
| Count | Nombre de commits React |
| Total ms | Somme des durées de commit |
| Avg | Total / Count |
| Max | Pire commit |
| Phase | `mount` (premier render) · `update` (re-render) · `nested-update` (triggered par un parent qui s'update) |

**Ce qu'on peut mesurer** :

- Count élevé + Avg faible = re-render spam (probable `useState`/context qui re-notify tout le sous-arbre).
- Max ponctuellement élevé = un render occasionnel coûteux (grosse liste, calcul inline).
- Ajoute `<ProfiledRegion id="MonComposant">` autour de zones suspectes pour isoler.

---

### SSE

Inspecteur d'événements Server-Sent Events. Le HUD monkey-patche `window.EventSource` pour intercepter chaque `MessageEvent`.

Deux vues :

- **Event types** — agrégat par type (`STATE_UPDATED`, `SPELL_CAST`, `DAMAGE_DEALT`, etc.) : count, bytes total, taille moyenne.
- **Recent** — flux chronologique inverse. ▼ pour dépl le payload JSON (tronqué à 2KB).

**Ce qu'on peut mesurer** :

- Un type qui explose en count = SSE fanout abusif (un changement = 10 events).
- Payload moyen >5KB = considérer un delta plutôt que full state.
- Gap entre event émis et FPS drop = render trop lourd déclenché par l'event.

---

### Tasks

Long tasks détectées par `PerformanceObserver({ entryTypes: ['longtask'] })` — tout code JS main-thread qui bloque >50ms.

| Colonne | Signification |
|---|---|
| Duration | Temps bloqué (>50ms par définition) |
| Name | Navigateur-specific (souvent `self` ou URL) |
| Attribution | Container type (iframe, same-origin, etc.) |

**Ce qu'on peut mesurer** :

- Chaque long task = un FPS drop garanti (une tâche de 200ms bloque 12 frames à 60 FPS).
- Corréle l'heure avec une action utilisateur pour trouver la cause.
- Les longs renders React apparaissent ici → bouche le trou avec l'onglet Renders.

---

### Backend

Snapshot du backend, rafraîchi toutes les 2s via `GET /debug/perf`.

**Runtime** :

- `Event loop p95` — lag p95 de l'event loop (via `monitorEventLoopDelay`). >50ms = backend saturé (CPU ou blocking I/O).
- `Event loop mean` — moyenne.
- `Heap used / limit` — mémoire JS utilisée vs max V8.
- `RSS` — mémoire résidente du process (incl. non-JS).
- `Uptime` — depuis le boot de l'API.
- `SSE streams / subs` — nb de connexions SSE actives.
- **Heap history** — sparkline sur les 4 dernières minutes (détecte les leaks).

**Garbage collection** (n'apparaît que si GC a tourné) :

- `GC count / total / max / last` — pauses cumulées.
- Table `byKind` : `major` (mark-sweep, pauses >10ms = suspect), `minor` (scavenge, normal), `incremental`, `weakcb`.

**Top routes (by p95)** : percentiles p50/p95/p99 par endpoint, comptage erreurs 5xx.

**Ce qu'on peut mesurer** :

- Heap history qui monte en continu sans redescendre = leak mémoire.
- GC major fréquent avec pauses >50ms = heap saturé (pré-leak ou allocation spam).
- Event loop p95 >50ms avec CPU bas = probablement du I/O sync (`fs.readFileSync`, `bcrypt.hashSync`).

---

### Prisma

Deux sections.

**Prisma operations** : stats agrégées par `model.action` (ex: `Player.findUnique`, `CombatSession.update`) via le middleware Prisma `$use`. Count, avg, p95, max.

**Raw SQL** : le SQL effectivement envoyé à Postgres, capté via l'event `query` de Prisma (requiert `SHOW_DEBUG=1`). Groupé par signature exacte. Bouton ▼ pour :

- Voir le SQL complet
- Voir les derniers params utilisés
- **🔍 Run EXPLAIN** → backend exécute `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` dans une transaction `SET TRANSACTION READ ONLY` (garantit aucun side-effect même sur une query mal classée)

Le plan est affiché comme un arbre collapsible :

- **Rouge** : `Seq Scan` (souvent un index manquant sur grosse table)
- **Vert** : `Index Scan / Index Only Scan` (bon)
- **Jaune** : `Hash Join / Merge Join / Nested Loop` (dépend du contexte)
- `Actual rows` vs `Plan rows` — si divergent de plus d'un ordre de grandeur = stats obsolètes (`ANALYZE`).
- Filter / Index Cond affichés en ligne.

**Ce qu'on peut mesurer** :

- Query p95 >100ms → clic ▼ → Run EXPLAIN → si `Seq Scan` sur table >1000 rows = ajouter un index.
- Plan avec `Actual Rows` énorme à un nœud qui finit en `rows=1` = filtre tardif, peut-être pas pushdown-able.
- `Planning Time >> Execution Time` = requête trop complexe ou stats inexactes.

**Sécurité** : l'endpoint refuse tout SQL ne commençant pas par `SELECT` (strip des commentaires d'abord) et force `READ ONLY` au niveau transaction. Même avec une query malicieuse, Postgres refuse.

---

### Game

Métriques **métier** instrumentées dans le code backend, groupées par scope.

Scopes actuels :

- `game.turn` — `action.MOVE`, `action.CAST_SPELL`, `action.END_TURN`, `action.JUMP` → durée de résolution d'un tour par type d'action.
- `game.spell` — durée par `SpellEffectKind` (`DAMAGE_PHYSICAL`, `HEAL`, `TELEPORT`, …).
- `game.pathfinding` — `bot.findPathToAdjacent` (A*).
- `game.matchmaking` — `wait` = temps passé dans la queue avant d'être matché.

**Ce qu'on peut mesurer** :

- `game.turn.action.CAST_SPELL` p95 >500ms = le combat "lag" côté gameplay.
- `game.pathfinding` p95 >100ms = le bot fait attendre trop longtemps sur grosses maps.
- `game.matchmaking.wait` médiane élevée = faible density de joueurs, pas un problème technique.

**Ajouter une nouvelle métrique** : dans n'importe quel service Nest, injecte `PerfStatsService` et appelle :

```ts
const startedAt = performance.now();
try { /* … */ } finally {
  this.perfStats.recordGameMetric('game.monscope', 'mon_operation', performance.now() - startedAt);
}
```

---

### Redis

Monitoring des commandes Redis (wrap de `ioredis`).

**Cache hit rate** (visible seulement si des GET ont été faits) : par préfixe de clé (tout avant le `:`), compte hits (GET→valeur) vs misses (GET→null). Code couleur : vert ≥80%, jaune 50-80%, rouge <50%.

**All Redis commands** : classé par p95. Colonne `Cmd:prefix` (ex: `get:combat`, `zadd:matchmaking`).

**Ce qu'on peut mesurer** :

- Hit rate <50% sur un préfixe = cache inefficace, TTL trop court ou clé jamais pré-remplie.
- `get:combat` qui revient souvent avec p95 >10ms = Redis saturé ou latence réseau.
- `zadd_many` lent = queue matchmaking mal indexée.

---

### Snap

Sauvegarde de snapshots dans `localStorage` pour comparer avant/après un changement.

**Save current state** : donne un label (ex: `before-spell-refactor`), clique 💾 Save. Le snapshot contient : FPS stats, vitals, long tasks, renders, requests, backend snapshot.

**Saved** : liste des snapshots (max 20, rotation FIFO). Clic sur un snapshot → affiche un **diff vs état actuel** :

| Métrique | Before | Now | Δ | % |

Color coding : vert = amélioration, rouge = régression (direction = "lower is better" pour vitals, loop lag, tasks ; = "higher is better" pour FPS).

**Workflow typique** :

1. Fais tourner l'app 30s, déclenche les actions pertinentes.
2. Save snapshot `before`.
3. Applique ton fix.
4. Relance 30s.
5. Clique sur `before` → regarde le diff.

---

## Partage IA (📋 / 💾)

Deux boutons dans l'en-tête du HUD.

### 📋 IA — Copier pour IA

Génère un rapport **Markdown** structuré contenant toutes les métriques actuelles + un suffixe "Analysis request" qui demande à l'IA 4 choses :

1. Top 3 bottlenecks probables
2. Root cause pour chacun
3. Liste d'actions priorisées (cheap wins d'abord)
4. Anomalies (p99 >> p95, FPS drops sans event loop lag, etc.)

Contenu du rapport : contexte (URL, viewport, UA), Frontend (FPS, Web Vitals, network, long tasks, renders, SSE, JS heap), Backend (runtime, GC, routes, Prisma, game metrics, Redis, recent requests).

Paste direct dans Claude/ChatGPT/etc.

### 💾 JSON

Télécharge un fichier `perf-snapshot-<timestamp>.json` avec les mêmes données en brut. Utile pour :

- Diff avec un autre snapshot JSON.
- Analyse programmatique (script custom).
- Archiver pour un post-mortem.

---

## Architecture

### Backend (`apps/api/src/shared/perf/`)

- `perf-stats.service.ts` — service central, buckets in-memory avec samples rolling (p50/p95/p99). Expose `recordHttp`, `recordPrisma`, `recordRawQuery`, `recordGameMetric`, `recordRedis`, `startTrace`/`finishTrace`.
- `http-perf.interceptor.ts` — intercepteur global Nest, mesure chaque requête + pose le header `Server-Timing` + ouvre/ferme une trace.
- `runtime-perf.service.ts` — monitorEventLoopDelay, `PerformanceObserver(['gc'])`, heap sampler.
- `request-context.middleware.ts` / `.service.ts` — propage `x-request-id` via `AsyncLocalStorage`.
- `debug-perf.controller.ts` — endpoints `/api/v1/debug/perf`, `/debug/perf/trace/:id`, `/debug/perf/explain`, `/debug/perf/reset` (tous gated par `SHOW_DEBUG`).
- `perf-logger.service.ts` — logs JSON structurés sur stdout (existant, indépendant).

### Frontend (`apps/web/src/perf/`)

- `perf-hud.store.ts` — Zustand store, source unique de vérité.
- `fetch-interceptor.ts` / `axios-interceptor.ts` — wrap les clients HTTP, capture `Server-Timing` et `x-request-id`.
- `sse-inspector.ts` — monkey-patch `window.EventSource`.
- `long-tasks.ts` — `PerformanceObserver(['longtask'])`.
- `fps-monitor.ts` — boucle `requestAnimationFrame`.
- `memory-monitor.ts` — polling `performance.memory` (Chrome).
- `web-vitals-reporter.ts` — lib `web-vitals`.
- `render-profiler.tsx` — `<ProfiledRegion>` wrapper autour de `React.Profiler`.
- `backend-poller.ts` — fetch `/debug/perf` toutes les 2s.
- `snapshots.ts` — save/load/diff dans `localStorage`.
- `share-report.ts` — génération Markdown + JSON.
- `PerfHud.tsx` — UI du panneau.
- `CanvasPerfOverlay.tsx` — charge `r3f-perf` lazy dans les `<Canvas>` R3F.

### Flux de données

```
Utilisateur clique
  → axios intercepté (id, start time)
    → HTTP request (avec x-request-id généré ou reçu)
      → Nest HttpPerfInterceptor → startTrace(requestId)
        → Controller → Service → PrismaService.$use → perfStats.recordPrisma + pushTraceQuery
        → Controller → Service → RedisService.measure → perfStats.recordRedis
      → Nest HttpPerfInterceptor → recordHttp + finishTrace + header Server-Timing
    → HTTP response (x-request-id, Server-Timing)
  → axios interceptor → perfStats frontend
  → HUD re-render

Toutes les 2s:
  backend-poller → GET /debug/perf → perfStats backend + runtime (event loop, GC, heap, SSE)
                                   + routes p50/95/99 + prisma + gameMetrics + redis + rawQueries
  → setBackend(snapshot)
  → HUD re-render
```

---

## Troubleshooting

### Le badge ⚡ Perf n'apparaît pas

- Vérifie `VITE_SHOW_DEBUG=1` dans `.env`.
- **Redémarre `yarn dev:web`** — Vite lit les variables d'env au démarrage.
- Dans la console navigateur : `import.meta.env.VITE_SHOW_DEBUG` doit afficher `"1"`.

### L'onglet Backend dit "Waiting for /debug/perf…"

- Vérifie `SHOW_DEBUG=1` dans `.env`.
- **Redémarre `yarn dev:api`**.
- Test direct : `curl http://localhost:3000/api/v1/debug/perf` doit retourner du JSON (pas un 403).

### L'onglet Prisma → Raw SQL est vide

- `SHOW_DEBUG=1` doit être set **avant** le boot Nest (les query events sont enregistrés à la construction du `PrismaClient`).
- Redémarre l'API et fais quelques queries (ex: login).

### `Run EXPLAIN` échoue avec "only allowed on SELECT"

- La query est un `INSERT/UPDATE/DELETE/UPSERT` (Prisma `create/update/delete`) — EXPLAIN refuse de les rejouer par sécurité.
- Seules les queries `findUnique/findMany/findFirst/count/aggregate` peuvent être EXPLAIN-ées.

### `r3f-perf` ne s'affiche pas sur la scène 3D

- Le HUD doit être **ouvert** (`Shift+P`). Le composant `r3f-perf` n'est monté que quand `enabled=true` dans le store.
- Fait uniquement dev (`VITE_SHOW_DEBUG=1`).

### Les requêtes du HUD (backend poller) polluent l'onglet Network

- Non — le filtre `/debug/perf` est appliqué dans les deux interceptors (axios + fetch) pour les ignorer.

### Les tests cassent après mon changement perf

- Ajoute le mock dans le spec :
  ```ts
  { provide: PerfStatsService, useValue: { recordGameMetric: jest.fn(), recordRedis: jest.fn() } }
  ```

---

## Limites connues

- `performance.memory` frontend = **Chrome only**. Firefox/Safari n'afficheront pas le heap JS.
- Les snapshots Snap utilisent `localStorage` (5-10MB max selon le navigateur) — les gros snapshots peuvent échouer silencieusement.
- Le raw SQL Prisma n'inclut pas les migrations ni les health checks `$executeRaw` manuels non instrumentés.
- `EXPLAIN ANALYZE` ajoute ~5-20% d'overhead à la query rejouée — ne pas spammer sur des queries >1s.
- Les traces end-to-end conservent les **100 dernières** seulement (rotation FIFO).

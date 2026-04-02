# ⚔️ Dofus-like — Jeu de Stratégie au Tour par Tour

Monorepo NX pour un jeu de stratégie au tour par tour sur navigateur inspiré de Dofus.

## 🎮 Phases de Jeu

1. **Exploration** — Récoltez des ressources sur la carte isométrique
2. **Économie** — Achetez, vendez et craftez des objets dans la boutique
3. **Combat** — Défiez d'autres joueurs dans des combats tactiques au tour par tour

## 📋 Prérequis

- Node.js 22+
- Docker & Docker Compose
- Yarn

## 🚀 Démarrage Rapide

### 1. Initialisation automatique (Recommandé)
```bash
# Clonez le repo et entrez dans le dossier
git clone <url> && cd Dofus-Like

# Lancez l'installation complète (Yarn, Docker, Prisma, Seed)
yarn setup
```

### 2. Lancement manuel
Si `yarn setup` échoue ou si vous préférez le faire étape par étape :
1. `yarn install`
2. `yarn docker:dev:infra` (PostgreSQL & Redis)
3. `cp .env.example .env`
4. `yarn db:migrate`
5. `yarn db:seed`
6. `yarn dev`

### 3. Connexion (Comptes de Test)
Utilisez ces comptes pré-configurés pour tester le jeu immédiatement :

| Archétype | Email | Mot de passe |
| :--- | :--- | :--- |
| **🛡️ Warrior** | `warrior@test.com` | `password123` |
| **🧙 Mage** | `mage@test.com` | `password123` |

> [!TIP]
> Pour tester un combat, connectez-vous avec le **Warrior** dans un onglet et le **Mage** dans un autre (navigation privée). Le Warrior peut alors défier le Mage via le lobby.

## 🏗️ Architecture

```
game-monorepo/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # JWT authentication
│   │   │   ├── player/         # Player + Stats services
│   │   │   ├── world/          # Resources (Équipe A)
│   │   │   ├── economy/        # Inventory, Items, Shop, Crafting (Équipe A)
│   │   │   ├── combat/         # Session, Turn, Spells, Map (Équipe B)
│   │   │   └── shared/         # Prisma, Redis, SSE
│   │   └── prisma/             # Schema + seed
│   └── web/                    # React + Three.js frontend
│       └── src/
│           ├── pages/          # Login, Lobby, Shop, Inventory, Combat, Map
│           ├── game/           # Composants Three.js (ResourceMap, CombatMap, HUD)
│           ├── store/          # Zustand (auth, combat)
│           └── api/            # Clients API typés (axios)
├── libs/
│   ├── shared-types/           # Interfaces/enums TypeScript partagés
│   ├── game-engine/            # Logique métier pure (calculs, formules)
│   └── ui-components/          # Composants React partagés
├── docker-compose.yml                         # Dev infra: PostgreSQL + Redis
├── docker-compose.dev-containers.override.yml # Dev parity: mêmes conteneurs que la prod
└── docker-compose.prod.yml                    # Prod locale: + API + Web
```

## 👥 Découpage Équipes

| | Équipe A (World + Economy) | Équipe B (Combat) |
|---|---|---|
| **Modules** | world/, economy/ | combat/ |
| **Émet** | ITEM_EQUIPPED, ITEM_UNEQUIPPED, SPELL_LEARNED | COMBAT_ENDED, COMBAT_PLAYER_DIED |
| **Consomme** | COMBAT_ENDED, COMBAT_PLAYER_DIED | ITEM_EQUIPPED, ITEM_UNEQUIPPED |
| **Données** | PostgreSQL (inventaire, items, joueurs) | Redis (état combat temps réel) |

### Contrat Inter-Équipes
- **PlayerStatsService** : calcule les stats effectives (base + items équipés) via `@game/game-engine`
- **GAME_EVENTS** : événements partagés définis dans `@game/shared-types`
- **CombatState** : interface partagée pour l'état de combat

## 📦 Commandes Utiles

| Commande | Description |
|---|---|
| `yarn dev` | Lance API + Web en parallèle |
| `yarn dev:api` | Lance uniquement l'API |
| `yarn dev:web` | Lance uniquement le frontend |
| `yarn build` | Build tous les projets |
| `yarn lint` | Lint tous les projets |
| `yarn test` | Tests tous les projets |
| `yarn perf:api:start` | Mesure le démarrage local de l'API et écrit le résumé dans `tmp/perf/` |
| `yarn perf:api:baseline` | Lance une baseline perf locale read-only et écrit les résultats dans `tmp/perf/` |
| `yarn perf:api:report` | Affiche le dernier résumé perf local |
| `yarn perf:api:compare` | Compare la dernière baseline aux budgets versionnés |
| `yarn db:migrate` | Exécute les migrations Prisma |
| `yarn db:studio` | Ouvre Prisma Studio |
| `yarn db:seed` | Seed la base de données |
| `yarn docker:dev` | Lance localement les mêmes conteneurs qu’en prod (`postgres`, `redis`, `api-setup`, `api`, `web`) |
| `yarn docker:dev:down` | Arrête la stack dev conteneurisée (`DEV_REMOVE_VOLUMES=1` pour purger les volumes) |
| `yarn docker:dev:infra` | Lance uniquement PostgreSQL + Redis pour le dev host classique |
| `yarn docker:prod` | Lance toute la stack en production |
| `yarn stack:prod-local` | Build les images locales et lance la stack prod-like en Docker |
| `yarn stack:prod-local:down` | Arrête la stack prod-like locale (`CI_LOCAL_REMOVE_VOLUMES=1` pour purger les volumes) |
| `yarn smoke:prod-local` | Vérifie en local le boot conteneurisé, les rooms privées et le matchmaking |
| `yarn repro:matchmaking:legacy-redis` | Reproduit et valide le cas Redis legacy `matchmaking:queue` |

## 🚢 CI/CD

- Les pull requests vers `dev` et `main` passent par la CI GitHub (`lint`, `test`, smoke Docker prod-like).
- Les merges sur `dev` deploient automatiquement une stack de test sur Portainer.
- Les merges sur `main` deploient automatiquement la production sur la stack Portainer principale.
- L’API expose `GET /api/v1/health` pour les smoke tests distants et le rollback automatique en production.
- La doc de configuration GitHub/Portainer est dans [DEPLOY.md](DEPLOY.md).

## 📈 Profiling Backend

- Les artefacts bruts de perf ne sont jamais versionnés et vivent uniquement dans `tmp/perf/`.
- Les budgets versionnés sont stockés dans `apps/api/perf-budgets.json`.
- Les scripts perf lot 1 sont majoritairement read-only et utilisent les comptes seedés existants.

## 🐳 Stack Prod-Like Locale

- `yarn stack:prod-local` construit les images locales API/Web puis lance la stack issue de `docker-compose.portainer.yml` avec l’override local.
- API locale : `http://127.0.0.1:13000`
- Web locale : `http://127.0.0.1:18080`
- `yarn smoke:prod-local` démarre une stack fraîche, valide le boot conteneurisé, crée une room privée, vérifie le matchmaking puis nettoie la stack.
- `yarn repro:matchmaking:legacy-redis` injecte l’ancien format Redis de `matchmaking:queue` pour vérifier l’auto-réparation avant push.
- `yarn stack:prod-local:down` arrête la stack. Ajoutez `CI_LOCAL_REMOVE_VOLUMES=1` si vous voulez supprimer les volumes et repartir de zéro.

## 🧪 Stack Dev Conteneurisée

- `yarn docker:dev` lance une stack locale avec les mêmes services qu’en prod: `postgres`, `redis`, `api-setup`, `api`, `web`, avec API/Web en mode dev dans les conteneurs, bind mounts et hot reload.
- Ports locaux:
  - PostgreSQL: `15432`
  - Redis: `16379`
  - API: `http://127.0.0.1:13000`
  - Web: `http://127.0.0.1:18080`
- Ces ports évitent les collisions avec `yarn dev` et `yarn docker:dev:infra`. Ils restent surchargeables via `DEV_POSTGRES_PORT`, `DEV_REDIS_PORT`, `DEV_API_PORT`, `DEV_WEB_PORT`.
- Les watchers Docker utilisent le polling; vous pouvez ajuster la fréquence via `DEV_WATCH_INTERVAL_MS`.
- `yarn docker:dev:down` arrête cette stack. Ajoutez `DEV_REMOVE_VOLUMES=1` pour supprimer les volumes.
- `yarn docker:dev:infra` reste disponible si vous voulez garder uniquement la base et Redis puis lancer `yarn dev` sur l’hôte.

## 🛠️ Stack Technique

- **Monorepo** : NX
- **Backend** : NestJS, TypeScript strict, Prisma, PostgreSQL 16
- **Frontend** : Vite, React 18, Three.js (@react-three/fiber), Zustand
- **État combat** : Redis 7 (ioredis)
- **Realtime** : SSE (Server-Sent Events)
- **Auth** : JWT (passport-jwt)
- **Validation** : class-validator + class-transformer
- **Docker** : Docker Compose (dev + prod)

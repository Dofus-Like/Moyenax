# ⚔️ Dofus-like — Jeu de Stratégie au Tour par Tour

Monorepo NX pour un jeu de stratégie au tour par tour sur navigateur inspiré de Dofus.

## 🎮 Phases de Jeu

1. **Exploration** — Récoltez des ressources sur la carte isométrique
2. **Économie** — Achetez, vendez et craftez des objets dans la boutique
3. **Combat** — Défiez d'autres joueurs dans des combats tactiques au tour par tour

## 📋 Prérequis

- Node.js 20+
- Docker & Docker Compose
- Yarn

## 🚀 Installation

```bash
git clone <url> && cd game-monorepo
cp .env.example .env
yarn run setup          # install + docker + migrate + seed
yarn run dev            # api (3000) + web (5173) en parallèle
```

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
├── docker-compose.yml          # Dev: PostgreSQL + Redis
└── docker-compose.prod.yml     # Prod: + API + Web
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
| `yarn db:migrate` | Exécute les migrations Prisma |
| `yarn db:studio` | Ouvre Prisma Studio |
| `yarn db:seed` | Seed la base de données |
| `yarn docker:dev` | Lance PostgreSQL + Redis |
| `yarn docker:prod` | Lance toute la stack en production |

## 🛠️ Stack Technique

- **Monorepo** : NX
- **Backend** : NestJS, TypeScript strict, Prisma, PostgreSQL 16
- **Frontend** : Vite, React 18, Three.js (@react-three/fiber), Zustand
- **État combat** : Redis 7 (ioredis)
- **Realtime** : SSE (Server-Sent Events)
- **Auth** : JWT (passport-jwt)
- **Validation** : class-validator + class-transformer
- **Docker** : Docker Compose (dev + prod)

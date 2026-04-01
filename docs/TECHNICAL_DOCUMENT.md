# Dossier d'Architecture Technique — Moyenax

Ce document décrit l'architecture logicielle, la stack technique, et l'organisation du monorepo du projet de jeu de stratégie au tour par tour.

---

## 1. Stack Technique

### Backend
- **Framework** : NestJS (TypeScript strict)
- **Base de données relationnelle** : PostgreSQL 16
- **ORM** : Prisma
- **Stockage en mémoire / Temps réel** : Redis 7 (via `ioredis`)
- **Authentification** : JWT (`passport-jwt`)
- **Validation payloads** : `class-validator` + `class-transformer`
- **Communication temps réel** : SSE (Server-Sent Events)

### Frontend
- **Framework** : React 18 (via Vite)
- **Moteur 3D** : Three.js via `@react-three/fiber` et `@react-three/drei`
- **Gestion d'état globale** : Zustand
- **Appels API** : Axios avec clients typés

### Outillage & DevOps
- **Gestion de Monorepo** : NX
- **Conteneurisation** : Docker & Docker Compose (environnements de dev et prod)
- **Gestionnaire de paquets** : Yarn

---

## 2. Architecture du Monorepo (NX)

Le projet est divisé en applications (`apps/`) et librairies partagées (`libs/`).

```text
game-monorepo/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # Système JWT
│   │   │   ├── player/         # Services Joueurs + Stats
│   │   │   ├── world/          # Cartes de ressources (Farming)
│   │   │   ├── economy/        # Inventaire, Items, Shop, Crafting
│   │   │   ├── combat/         # Sessions, Tours, Sorts, Arène 3D
│   │   │   └── shared/         # Prisma, Redis, SSE
│   └── web/                    # React + Three.js frontend
│       └── src/
│           ├── pages/          # Login, Lobby, Shop, Inventory, Combat, Map
│           ├── game/           # Composants 3D (ResourceMapScene, CombatMapScene)
│           ├── store/          # Store Zustand (auth, combat, inventaire)
│           └── api/            # Clients API
├── libs/
│   ├── shared-types/           # Interfaces, DTOs et enums TS partagés (contrat front/back)
│   ├── game-engine/            # Logique métier pure (calculs dégâts, ligne de vue, stats)
│   └── ui-components/          # Composants React UI réutilisables
```

---

## 3. Logique Métier : la librairie `game-engine`

Toute la logique de règles du jeu — indépendante de l'infrastructure web ou de la base de données — est isolée dans la librairie agnostique `libs/game-engine/`.
- **Calcul des stats effectives** : Un service ou des helpers fusionnent les stats de base et les bonus des items équipés.
- **Moteur de combat pure** : Algorithmes de ligne de vue (LoS), calculs de distance rectiligne (Manhattan) ou vectorielle, formules de dégâts (Physique/Magique), et résolution mathématique des sorts.
- **Avantage architectural** : Permet de tester unitairement la logique du jeu rapidement. De plus, ces fonctions peuvent être réutilisées à la fois par le front (pour la prédiction, les prévisualisations UI) et par le back (pour la validation stricte des actions).

---

## 4. Données et Persistance

### PostgreSQL (Équipe A : World & Economy)
La base de données relationnelle est utilisée comme source de vérité (stockage à froid) pour :
- Entités joueurs et credentials.
- Inventaire global stocké.
- Définition des objets, statistiques d'items, requêtes de craft (recettes).
- Or et possession de base.

### Redis (Équipe B : Combat & Temps Réel)
Le système de combat nécessite de la très haute performance et des lectures/écritures constantes durant les parties. Il utilise Redis (stockage in-memory volatile) pour :
- Sessions de combat actives.
- Matériaux et entités transitoires sur la grille (obstacles, joueurs, pièges posés).
- Gestion des tours (timers temporels, PA/PM restants, états temporaires de buffs/debuffs).

---

## 5. Communications Temps Réel (SSE)

En lieu et place des WebSockets habituels, le flux de données en cours de combat passe par des Server-Sent Events (SSE). 
- Le flux est unidirectionnel depuis le serveur : le backend diffuse des événements (`COMBAT_STARTED`, `STATE_UPDATED`, `TURN_STARTED`).
- Le client joue ses coups via des appels API REST (ex: `POST /combat/action`), qui déclenchent le recalcul serveur, mettant ainsi à jour l'état dans Redis.
- L'état mis à jour est re-poussé par SSE, mis en cache dans le frontend via Zustand, causant un nouveau rendu via `@react-three/fiber`.

---

## 6. Communication Inter-Équipes et Événements Locaux

Pour s'assurer d'un couplage lâche, l'Équipe A (Economie/Items) et l'Équipe B (Combat) ne s'appellent pas directement au travers de leurs services métiers. Elles communiquent par le bus d'événements de NestJS (`EventEmitter2`).

Les clés de ces événements sont définies par des constantes dans `libs/shared-types` :

| Constante d'Événement | Émis par | Consommé par | Rôle & Payload |
|-----------------------|----------|-------------|-----------------|
| `ITEM_EQUIPPED` | Équipe A | Équipe B | Mise à jour des stats actives. Payload: `{ playerId, itemId, slot }` |
| `ITEM_UNEQUIPPED` | Équipe A | Équipe B | Retrait de stats. Payload: `{ playerId, itemId, slot }` |
| `SPELL_LEARNED` / `SPELLS_CHANGED` | Équipe A | Équipe B | Notifie le moteur des sorts débloqués ou up-rang. Payload: `{ playerId, spells: [{ spellId, level }] }` |
| `COMBAT_ENDED` | Équipe B | Équipe A | Indique le résultat pour la distribution de monnaie/loot. Payload: `{ sessionId, winnerId, loserId }` |
| `COMBAT_PLAYER_DIED` | Équipe B | Systèmes logs | Événement pour trigger des animations spécifiques ou logs si pertinent. Payload: `{ sessionId, playerId }` |

**Exemple de flux typique :**
1. Un joueur s'équipe d'une arme (l'Équipe A gère la mise à jour d'Inventaire en BDD relationnelle).
2. Émission en mémoire de `ITEM_EQUIPPED` et de `SPELLS_CHANGED`.
3. L'Équipe B écoute cet événement, recalcule l'API Stats du joueur et met en cache ses nouvelles compétences dans le scope d'un futur Combat.
4. Lors d'un match PVP, la source de vérité Stats/Spells sera lue depuis ce cache.

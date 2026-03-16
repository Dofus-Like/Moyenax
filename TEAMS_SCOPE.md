# Scoping des Équipes (Team A & Team B)

Ce document définit les responsabilités et les périmètres d'action de chaque équipe pour minimiser les conflits et les effets de bord lors du développement du jeu.

## 🧱 Principes Généraux
- Chaque équipe est propriétaire de ses modules.
- Toute modification d'un module transverse (Shared, Libs) doit être coordonnée.
- Les communications inter-modules se font via des événements (`GAME_EVENTS`) ou des services injectés.

---

## 🏗️ Équipe A : World & Economy
**Responsable de l'exploration, de la gestion des ressources et de l'aspect social.**

### 📂 Périmètre (NestJS API)
- `apps/api/src/world/` : Gestion de la carte du monde, récolte des ressources, régénération.
- `apps/api/src/economy/` :
    - `inventory/` : Stockage, équipement des objets.
    - `items/` : Définition des objets (stats, prix).
    - `shop/` : Achat/Vente d'objets.
    - `crafting/` : Recettes et fabrication.
- `apps/api/src/player/` : Profil joueur et stats de base.

### 📂 Périmètre (React Web)
- `apps/web/src/pages/ResourceMapPage.tsx`
- `apps/web/src/pages/ShopPage.tsx`
- `apps/web/src/pages/InventoryPage.tsx`
- `apps/web/src/game/ResourceMap/` (Scène Three.js)

### 📡 Événements émis
- `ITEM_EQUIPPED`
- `ITEM_UNEQUIPPED`
- `SPELL_LEARNED`

---

## ⚔️ Équipe B : Combat System
**Responsable de la mécanique de combat, du tour par tour et du temps réel.**

### 📂 Périmètre (NestJS API)
- `apps/api/src/combat/` :
    - `session/` : Initiation et gestion des sessions de combat (Redis/SSE).
    - `turn/` : Logique du tour par tour, validation des actions.
    - `spells/` : Calcul des effets des sorts.
    - `map/` : Génération de la carte de combat et gestion des positions.

### 📂 Périmètre (React Web)
- `apps/web/src/pages/CombatPage.tsx`
- `apps/web/src/game/CombatMap/` (Scène Three.js)
- `apps/web/src/game/HUD/CombatHUD.tsx`
- `apps/web/src/store/combat.store.ts`

### 📡 Événements émis
- `COMBAT_STARTED`
- `TURN_STARTED`
- `COMBAT_ENDED`
- `PLAYER_DIED`

---

## 🧠 Partage des Libs
- `libs/shared-types` : Co-propriété. Toute modification des types doit être validée par les deux équipes.
- `libs/game-engine` : Co-propriété. Contient la logique de calcul de dommages et de stats partagée.
- `libs/ui-components` : Co-propriété. Composants UI réutilisables.

---

## ⚠️ Règles Inter-Équipes
1. **Équipe B** ne doit pas modifier directement l'or ou l'inventaire. Elle émet un événement `COMBAT_ENDED` et l'**Équipe A** gère les récompenses.
2. **Équipe A** ne doit pas modifier l'état d'un combat en cours.
3. Les calculs de stats se font exclusivement via le `PlayerStatsService` (Équipe A) qui utilise le `game-engine`.

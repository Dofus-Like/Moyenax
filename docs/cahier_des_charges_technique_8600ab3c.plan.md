---
name: Cahier des charges technique
overview: Cahier des charges technique du jeu Moyenax, decoupant l'ensemble des fonctionnalites du GDD V2 en Epics, User Stories et Tasks, ancre dans l'architecture existante (NX monorepo, NestJS, Prisma, React 19, Three.js).
todos:
  - id: epic1-schema
    content: "EPIC 1 : Refonte schema Prisma, types partages et seed"
    status: completed
  - id: epic2-map
    content: "EPIC 2 : Carte et terrain (generation par seed, rendu 3D MUR/TROU/PLAT)"
    status: completed
  - id: epic3-farming
    content: "EPIC 3 : Farming de ressources (instances, 4 pips/manche, 5 manches)"
    status: completed
  - id: epic4-equipment
    content: "EPIC 4 : Systeme d'items et equipement (mannequin, rangs, combos, spells)"
    status: in-progress
  - id: epic5-crafting
    content: "EPIC 5 : Systeme de crafting (Rang 1 + fusion + consommables)"
    status: completed
  - id: epic6-shop
    content: "EPIC 6 : Systeme de shop / economie (achat, vente, counter-build, recompenses)"
    status: in-progress
  - id: epic7-combat
    content: "EPIC 7 : Combat PvP (sessions, tours, 9 spells, terrain MUR/TROU/PLAT, reveal mannequins)"
    status: in-progress
  - id: epic8-ui
    content: "EPIC 8 : Interface utilisateur (pages, 3D, HUD, seed dans lobby)"
    status: in-progress
  - id: epic9-events
    content: "EPIC 9 : Evenements inter-equipes"
    status: pending
isProject: false
---

# Cahier des charges technique -- Moyenax (aligne GDD V2)

Le projet est un monorepo NX avec :

- **Backend** : NestJS + Prisma (PostgreSQL) + Redis + SSE -- `apps/api/`
- **Frontend** : React 19 + Vite + Three.js + Zustand + TanStack Query -- `apps/web/`
- **Types partages** : `libs/shared-types/`

Le GDD V2 introduit un **systeme de seeds** (6 configurations) qui determine les ressources presentes sur la map et oriente le build de chaque joueur. Le jeu se deroule en **5 manches** avec 4 pips de recolte par manche, un cycle Farming > Shop/Craft > Equipement, et un combat PvP a la manche 5. Trois archetypes (Guerrier, Mage, Ninja) sont lies aux familles de ressources (FORGE, ARCANE, NATURE). Les terrains ont 3 comportements combat : **MUR** (bloque mouvement + LdV), **TROU** (bloque mouvement, LdV libre, saut possible), **PLAT** (libre).

---

## EPIC 1 -- Fondations (Refonte modele de donnees)

> Prerequis de tous les autres Epics. Refondre le schema Prisma, les types partages et le seed pour correspondre au GDD V2.

### US 1.1 -- Refonte du schema Prisma

En tant que developpeur, je veux un schema de donnees aligne sur le GDD V2.

**Tasks :**

- T1.1.1 : Mettre a jour l'enum `ItemType` : `WEAPON`, `ARMOR_HEAD`, `ARMOR_CHEST`, `ARMOR_LEGS`, `ACCESSORY`, `CONSUMABLE`, `RESOURCE`
- T1.1.2 : Ajouter un champ `rank` (Int, default 1, range 1-3) sur `InventoryItem` pour gerer les rangs d'arme/armure
- T1.1.3 : Ajouter un champ `grantsSpells` (Json, liste de spell IDs) sur le modele `Item`
- T1.1.4 : Ajouter un champ `family` (enum: `FORGE`, `ARCANE`, `NATURE`, `SPECIAL`, nullable) sur le modele `Item`
- T1.1.5 : Remplacer le modele `PlayerStats` : `vit` (100), `atk` (5), `mag` (0), `def` (0), `res` (0), `ini` (10), `pa` (6), `pm` (3)
- T1.1.6 : Creer un modele `EquipmentSlot` avec `playerId`, `slot` (enum: `WEAPON_LEFT`, `WEAPON_RIGHT`, `ARMOR_HEAD`, `ARMOR_CHEST`, `ARMOR_LEGS`, `ACCESSORY`), `inventoryItemId` (nullable FK)
- T1.1.7 : Supprimer le champ `equipped: Boolean` de `InventoryItem` (remplace par `EquipmentSlot`)
- T1.1.8 : Supprimer le modele `PlayerSpell` et la table `Spell` en dur (les spells sont calcules dynamiquement depuis l'equipement)
- T1.1.9 : Generer et appliquer la migration Prisma

### US 1.2 -- Refonte des types partages

En tant que developpeur, je veux des interfaces TypeScript alignees sur le GDD V2.

**Tasks :**

- T1.2.1 : Mettre a jour `ItemType` dans `libs/shared-types/src/player.types.ts`
- T1.2.2 : Mettre a jour `PlayerStats` : `{ vit, atk, mag, def, res, ini, pa, pm }`
- T1.2.3 : Ajouter `StatsBonus` interface : `{ vit?, atk?, mag?, def?, res?, ini?, pa?, pm? }`
- T1.2.4 : Ajouter `SpellId` enum avec les 9 spells, `SpellLevel` (1-3), `PlayerSpell` interface
- T1.2.5 : Ajouter `EquipmentSlotType` enum et `Equipment` interface
- T1.2.6 : Verifier `TerrainType` enum (GROUND, IRON, LEATHER, CRYSTAL, FABRIC, WOOD, HERB, GOLD) -- **deja fait** dans `map.types.ts`
- T1.2.7 : Verifier `ResourceFamily` (FORGE, ARCANE, NATURE, SPECIAL), `CombatTerrainType` (FLAT, WALL, HOLE) -- **deja fait**
- T1.2.8 : Verifier `SeedId`, `SeedConfig`, `SEED_CONFIGS` (6 seeds) -- **deja fait**
- T1.2.9 : Ajouter `DamageChannel` enum (PHYSICAL, MAGICAL)
- T1.2.10 : Mettre a jour `CombatAction` avec `JUMP` en plus de `MOVE`, `CAST_SPELL`, `END_TURN`

### US 1.3 -- Seed complet du jeu

En tant que developpeur, je veux un seed Prisma conforme au GDD V2 avec tous les items, ressources et recettes.

**Tasks :**

- T1.3.1 : Creer les 7 ressources : Fer (FORGE), Cuir (FORGE), Cristal Magique (ARCANE), Etoffe (ARCANE), Bois (NATURE), Herbe Medicinale (NATURE), Or (SPECIAL)
- T1.3.2 : Creer les 6 armes Rang 1 (Epee, Bouclier, Baton, Grimoire, Kunai, Bombe ninja) avec `statsBonus`, `grantsSpells`, `shopPrice`, `family`
- T1.3.3 : Creer les 9 armures Rang 1 (Heaume, Armure, Bottes de Fer, Chapeau de Mage, Toge de Mage, Bottes de Mage, Bandeau, Kimono, Geta) avec `statsBonus`, `craftCost`, `family`
- T1.3.4 : Creer les 3 anneaux (Anneau du Guerrier, Anneau du Mage, Anneau du Ninja) avec `statsBonus`, `grantsSpells`, `craftCost`
- T1.3.5 : Creer les 3 consommables (Potion de Soin, Potion de Force, Potion de Vitesse) avec `shopPrice` et `craftCost`
- T1.3.6 : Creer 2 joueurs de test avec inventaire, equipement et or

---

## EPIC 2 -- Carte et terrain

> Carte 20x20 generee selon le seed de la partie. Meme carte pour farming et combat.

### US 2.1 -- Generation de la carte par seed

En tant que joueur, je veux une carte 20x20 dont les ressources presentes dependent du seed tire.

**Tasks :**

- T2.1.1 : `MapGeneratorService.generate(seedId)` : genere une grille 20x20, place uniquement les ressources du seed -- **deja fait**
- T2.1.2 : `SEED_CONFIGS` definit 6 seeds avec leurs ressources autorisees -- **deja fait**
- T2.1.3 : Stocker la carte de reference en Redis (`game:reference-map`) -- **deja fait**
- T2.1.4 : Definir `TERRAIN_PROPERTIES` avec `combatType` (MUR/TROU/PLAT), `family`, `traversable`, `blockLineOfSight`, `jumpable`, `harvestable` -- **deja fait**
- T2.1.5 : `POST /map/reset` genere une nouvelle carte avec un seed aleatoire (ou specifie) -- **deja fait**
- T2.1.6 : `GET /map` retourne la carte avec `seedId` -- **deja fait**
- T2.1.7 : Garantie de connectivite entre zones de spawn (carve un corridor si bloque) -- **deja fait**

### US 2.2 -- Rendu 3D de la carte

En tant que joueur, je veux voir la carte en 3D isometrique avec des visuels distincts par type de terrain.

**Tasks :**

- T2.2.1 : `TerrainTile` avec mesh different par `CombatTerrainType` : MUR = box volumetrique, TROU = depression sombre, PLAT ressource = cercle au sol -- **deja fait**
- T2.2.2 : Couleurs par famille : FORGE (rouge/brun), ARCANE (violet), NATURE (vert), SPECIAL/Or (ambre) -- **deja fait**
- T2.2.3 : Camera orthographique avec OrbitControls (rotation, zoom, pan) -- **deja fait**
- T2.2.4 : Badge seed dans le header de la page carte -- **deja fait**
- T2.2.5 : Panneau info en bas a gauche avec type combat, famille, traversabilite -- **deja fait**
- T2.2.6 : Pathfinding A* et pion joueur avec animation de deplacement -- **deja fait**
- T2.2.7 : Preview du chemin au hover -- **deja fait**

---

## EPIC 3 -- Farming de ressources

> Recolte de ressources dans des instances separees avec systeme de pips et manches.

### US 3.1 -- Instances de farming separees

En tant que joueur, je veux farmer dans ma propre instance pour que l'autre joueur n'affecte pas mes ressources.

**Tasks :**

- T3.1.1 : Creer `FarmingInstanceService` qui gere l'etat par joueur en Redis (carte + pips restants + manche courante)
- T3.1.2 : A l'entree sur `/map`, initialiser l'instance du joueur a partir de la carte de reference du seed
- T3.1.3 : Endpoint `GET /farming/state` : retourne l'instance du joueur (carte, pips, manche)

### US 3.2 -- Recolte de ressources (4 pips par manche)

En tant que joueur, je veux cliquer sur un node pour recolter et consommer un pip.

**Tasks :**

- T3.2.1 : Endpoint `POST /farming/gather` : verifier que le joueur a des pips restants (>0), ajouter la ressource a l'inventaire (+1), decrementer le pip (4 -> 3 -> 2 -> 1 -> 0)
- T3.2.2 : Les nodes restent presents (ressource illimitee tant que des pips sont disponibles) -- pas de suppression de node
- T3.2.3 : Verifier que le joueur est adjacent au node (Manhattan = 1) ou sur le node (PLAT harvestable)
- T3.2.4 : Frontend : afficher les 4 pips de recolte (plein/vide) dans un HUD farming

### US 3.3 -- Systeme de manches (5 manches par partie)

En tant que joueur, je veux passer a la manche suivante et acceder au shop/craft entre les manches.

**Tasks :**
Lien vers la documentation précise: 
https://docs.google.com/spreadsheets/d/1U8QDxftGqVoJ07w--pSgFkm8C_LyNPRy/edit?gid=550822847#gid=550822847
- T3.3.1 : Tracker le numero de manche par instance (1 -> 5)
- T3.3.2 : Bouton "Terminer la manche" : recharge les 4 pips, incremente la manche, redirige vers shop/craft
- T3.3.3 : A la manche 5 apres le farming : rediriger vers le combat PvP
- T3.3.4 : Frontend : afficher `Manche X/5` dans le HUD farming
- T3.3.5 : Endpoint `POST /farming/end-round` : valide le passage de manche, reset les pips, incremente le compteur

---

## EPIC 4 -- Systeme d'items et equipement

> Mannequin 6 slots, rangs d'armure/arme, combos, full sets, calcul dynamique des spells.

### US 4.1 -- Mannequin d'equipement (Backend)

En tant que joueur, je veux equiper mes items sur un mannequin a 6 slots pour definir mes stats et sorts.

**Tasks :**

- T4.1.1 : Creer `EquipmentService` avec methodes `equip(playerId, inventoryItemId, slot)` et `unequip(playerId, slot)`
- T4.1.2 : Validation : verifier que le type de l'item correspond au slot (WEAPON -> WEAPON_LEFT/RIGHT, ARMOR_HEAD -> ARMOR_HEAD, etc.)
- T4.1.3 : Validation : un item deja equipe ne peut pas etre equipe a nouveau
- T4.1.4 : Endpoint `GET /equipment` : retourne les 6 slots avec l'item equipe (ou null)
- T4.1.5 : Endpoint `PUT /equipment/:slot` : equiper un item
- T4.1.6 : Endpoint `DELETE /equipment/:slot` : desequiper un item
- T4.1.7 : A chaque changement d'equipement, recalculer stats et spells (voir US 4.3 et 4.4)

### US 4.2 -- Mannequin d'equipement (Frontend)

En tant que joueur, je veux une page inventaire avec un mannequin visuel et du drag & drop.

**Tasks :**

- T4.2.1 : Refactorer `InventoryPage.tsx` : layout 2 colonnes (mannequin gauche, inventaire droite)
- T4.2.2 : Composant `Mannequin` avec 6 slots visuels (Main G, Main D, Haut, Milieu, Bas, Accessoire)
- T4.2.3 : Drag & drop depuis la liste d'inventaire vers un slot compatible
- T4.2.4 : Panneau bas : stats effectives et spells debloques avec niveau
- T4.2.5 : API client : `equipmentApi.getEquipment()`, `equipmentApi.equip(slot, itemId)`, `equipmentApi.unequip(slot)`

### US 4.3 -- Calcul des stats effectives

En tant que joueur, je veux que mes stats refletent exactement ce que j'ai equipe (y compris le rang de l'item).

**Tasks :**

- T4.3.1 : Creer `StatsCalculatorService.computeEffectiveStats(playerId)` : stat_base + somme(statsBonus par rang de chaque item equipe)
- T4.3.2 : Refactorer `PlayerStatsService` pour utiliser `StatsCalculatorService`
- T4.3.3 : Stocker les stats effectives en cache Redis pour les lectures rapides
- T4.3.4 : Invalider le cache a chaque changement d'equipement

### US 4.4 -- Detection combos, full sets et calcul des spells

En tant que joueur, je veux que mes spells se debloquent et montent en niveau selon mes combos d'items.

**Tasks :**

- T4.4.1 : Creer `SpellResolverService.resolveSpells(equipment)` qui retourne `Map<SpellId, level>`
- T4.4.2 : Implementer les 3 combos d'armes : Epee+Bouclier -> Bond, Baton+Grimoire -> Soin, Kunai+Bombe ninja -> Velocite
- T4.4.3 : Implementer les 3 Full Sets : Guerrier (Heaume+Armure+Bottes de Fer) -> Bond+Endurance, Mage (Chapeau+Toge+Bottes de Mage) -> Menhir+Soin, Ninja (Bandeau+Kimono+Geta) -> Bombe de Repousse+Velocite
- T4.4.4 : Implementer le comptage de sources : chaque source distincte (item seul, combo, full set, anneau) ajoute +1 au niveau du spell, max 3
- T4.4.5 : Emettre l'evenement `player.spells.changed` a chaque recalcul

### US 4.5 -- Rangs d'items (fusion / merge)

En tant que joueur, je veux fusionner 2 items identiques de meme rang pour obtenir le rang superieur.

**Tasks :**

- T4.5.1 : Logique de merge dans `CraftingService` : verifier 2x meme item meme rang en inventaire, consommer les deux, creer l'item au rang +1
- T4.5.2 : Si l'un des items est equipe, bloquer le merge (ou desequiper automatiquement)
- T4.5.3 : Endpoint `POST /crafting/merge` avec `{ itemId, currentRank }`
- T4.5.4 : Frontend : dans la page crafting, onglet "Fusion" montrant les merges possibles

---

## EPIC 5 -- Systeme de crafting

> Fabrication d'items Rang 1 et consommables a partir de ressources.

### US 5.1 -- Craft d'items Rang 1

En tant que joueur, je veux crafter des armures, armes et anneaux a partir de ressources recoltees.

**Tasks :**

- T5.1.1 : Mettre a jour `CraftingService.craft()` pour lire `craftCost` de l'item et verifier les ressources du joueur
- T5.1.2 : Transaction atomique : deduire les ressources, creer l'item dans l'inventaire (rang 1)
- T5.1.3 : Endpoint existant `POST /crafting/craft` reste identique

### US 5.2 -- Page crafting (Frontend)

En tant que joueur, je veux une interface de crafting organisee par archetype avec badges hors-seed.

**Tasks :**

- T5.2.1 : Creer `CraftingPage.tsx` (route `/crafting`)
- T5.2.2 : 4 onglets : Guerrier (FORGE), Mage (ARCANE), Ninja (NATURE), Consommables
- T5.2.3 : Pour chaque recette : nom, ingredients requis (quantite possedee), stats bonus, bouton "Crafter" (desactive si ressources insuffisantes)
- T5.2.4 : Badge **"Hors-seed"** en orange sur les recettes dont une ressource est absente du seed actif
- T5.2.5 : Section "Fusion" : liste des items fusionnables (2x meme item meme rang)

---

## EPIC 6 -- Systeme de shop / economie

> Boutique PNJ avec achat, vente, et mecanisme de counter-build.

### US 6.1 -- Achat d'items

En tant que joueur, je veux acheter des armes, armures, anneaux et consommables au shop.

**Tasks :**

- T6.1.1 : Verifier que `ShopService.buy()` fonctionne avec les nouveaux items : 6 armes (4 or), 9 armures (3 or), 3 anneaux (3 or), 3 potions (2 or)
- T6.1.2 : Frontend : cabler le bouton "Acheter" dans `ShopPage.tsx`
- T6.1.3 : Afficher l'or du joueur, les stats bonus, et un badge famille colore (FORGE rouge, ARCANE violet, NATURE vert) sur chaque item
- T6.1.4 : Badge **"Hors-seed"** en orange sur les items dont la ressource est absente du seed actif

### US 6.2 -- Vente d'items

En tant que joueur, je veux vendre des items de mon inventaire pour recuperer de l'or.

**Tasks :**

- T6.2.1 : `ShopService.sell()` : prix de vente = 50% du `shopPrice`, verifier que l'item n'est pas equipe
- T6.2.2 : Frontend : bouton "Vendre" dans l'inventaire et dans le shop
- T6.2.3 : Confirmation avant vente (modal)

### US 6.3 -- Recompenses de combat

En tant que joueur vainqueur, je veux recevoir 50 or.

**Tasks :**

- T6.3.1 : Ecouter l'evenement `combat.ended` dans `EconomyModule`
- T6.3.2 : Crediter 50 or au `winnerId`

---

## EPIC 7 -- Combat PvP

> Combat au tour par tour sur grille 20x20. Arene = copie figee de la carte du seed. Terrains MUR/TROU/PLAT appliques.

### US 7.1 -- Sessions de combat et reveal des mannequins

En tant que joueur, je veux defier un autre joueur et voir son equipement au debut du combat.

**Tasks :**

- T7.1.1 : Refactorer `SessionService` pour copier la grille 20x20 (depuis la carte de reference du seed) au lancement du combat
- T7.1.2 : Stocker l'etat du combat en Redis : grille, positions, VIT, buffs, cooldowns, menhirs
- T7.1.3 : Placer les joueurs sur des zones de spawn predefinies (coins opposes, cases libres)
- T7.1.4 : Charger les stats effectives et les spells de chaque joueur (depuis `StatsCalculatorService` et `SpellResolverService`)
- T7.1.5 : Au `COMBAT_STARTED` (SSE), reveler les items equipes et stats des deux joueurs
- T7.1.6 : Frontend : panneaux mannequins gauche (soi) et droite (adversaire) avec items et stats revelees

### US 7.2 -- Systeme de tours

En tant que joueur, je veux jouer tour par tour avec PA et PM reinitialises.

**Tasks :**

- T7.2.1 : Tour loop : alternance des joueurs, reinitialisation PA/PM, decrementation cooldowns
- T7.2.2 : Decrementer les durees des buffs (Endurance, Velocite) et menhirs au debut de chaque tour
- T7.2.3 : Suppression des menhirs expires (duree = 0)
- T7.2.4 : SSE : pousser l'etat mis a jour aux deux joueurs apres chaque action

### US 7.3 -- Deplacement et saut sur TROU

En tant que joueur, je veux me deplacer sur la grille et sauter par-dessus les TROU (Or).

**Tasks :**

- T7.3.1 : Action `MOVE` : 1 PM par case, mouvement Manhattan, case traversable (PLAT ou GROUND)
- T7.3.2 : Action `JUMP` : 1 PM, sauter par-dessus un TROU (Or) adjacent, atterrir de l'autre cote (case libre requise)
- T7.3.3 : Les terrains MUR (Fer, Cristal, Bois) et les menhirs invoques bloquent le mouvement
- T7.3.4 : Frontend : highlight des cases accessibles au clic sur le joueur

### US 7.4 -- Ligne de vue

En tant que joueur, je veux que les sorts respectent la ligne de vue.

**Tasks :**

- T7.4.1 : Implementer l'algorithme de ligne de vue (raycasting sur grille)
- T7.4.2 : Terrains MUR (Fer, Cristal, Bois) et menhirs invoques bloquent la LdV
- T7.4.3 : Terrains TROU (Or), PLAT (Cuir, Etoffe, Herbe) et GROUND ne bloquent pas la LdV
- T7.4.4 : Frontend : au survol d'une case, afficher si elle est a portee ET en ligne de vue

### US 7.5 -- Initiative

En tant que joueur, je veux que l'ordre du premier tour soit determine par l'initiative.

**Tasks :**

- T7.5.1 : Au debut du combat, calculer `score = INI + random(0, 9)` pour chaque joueur
- T7.5.2 : Le joueur avec le score le plus eleve joue en premier

### US 7.6 -- Les 9 spells (effets)

En tant que joueur, je veux lancer mes sorts avec des effets correspondant a leur niveau.

**Tasks :**

- T7.6.1 : Definir `SPELL_DEFINITIONS` avec stats par niveau (cout PA, portee, degats, cooldown, special)
- T7.6.2 : **Frappe** : degats physiques CaC, lvl 3 ignore 50% DEF
- T7.6.3 : **Bond** : teleportation de 2/3/4 cases, passe par-dessus MUR et TROU
- T7.6.4 : **Endurance** : buff DEF +3/+5/+8 pendant 2/2/3 tours
- T7.6.5 : **Menhir** : invoque un obstacle MUR temporaire, duree 2/3/3 tours, lvl 3 = 2 menhirs
- T7.6.6 : **Boule de Feu** : degats magiques distance, lvl 3 = AoE (4 cases adjacentes, 50% degats)
- T7.6.7 : **Lancer de Kunai** : degats physiques distance, lvl 3 = 2 lancers par tour
- T7.6.8 : **Bombe de Repousse** : degats physiques + repousse 1/2/3 cases, lvl 3 = degats bonus +50% si collision MUR
- T7.6.9 : **Velocite** : buff PM +2/+3/+4 pendant 1/2/2 tours, lvl 3 = INI +5
- T7.6.10 : **Soin** : heal magique (scaling 50% MAG)

### US 7.7 -- Formules de degats (2 canaux)

En tant que joueur, je veux que les degats soient calcules selon le canal physique ou magique.

**Tasks :**

- T7.7.1 : Formule physique : `degats_finaux = max(1, degats_base + ATK - DEF_cible)` -- sorts : Frappe, Lancer de Kunai, Bombe de Repousse
- T7.7.2 : Formule magique : `degats_finaux = max(1, degats_base + MAG - RES_cible)` -- sorts : Boule de Feu
- T7.7.3 : Formule soin : `soin_effectif = soin_base + floor(MAG * 0.5)` -- sort : Soin

### US 7.8 -- Condition de victoire et recompenses

En tant que joueur, je veux que le combat se termine quand un joueur tombe a 0 VIT.

**Tasks :**

- T7.8.1 : Verifier VIT <= 0 apres chaque action de degats
- T7.8.2 : Declarer le vainqueur, emettre `combat.ended` et `combat.player.died`
- T7.8.3 : Rediriger les deux joueurs vers le lobby

---

## EPIC 8 -- Interface utilisateur

> Pages frontend, composants 3D, HUD, affichage du seed.

### US 8.1 -- Page Login

En tant que joueur, je veux m'inscrire et me connecter.

**Tasks :**

- T8.1.1 : Verifier que `LoginPage.tsx` fonctionne avec le backend actuel -- **deja fait**

### US 8.2 -- Page Lobby (avec seed actif)

En tant que joueur, je veux un hub central affichant le seed actif, mes stats et la navigation.

**Tasks :**

- T8.2.1 : Afficher le **seed actif** de facon prominente : label du seed, ressources presentes/absentes, build dominant
- T8.2.2 : Afficher or, pseudo, stats effectives (8 stats : VIT, ATK, MAG, DEF, RES, INI, PA, PM), spells actifs avec niveau
- T8.2.3 : 6 boutons de navigation : Carte, Boutique, Inventaire, Crafting, Combat, compteur `Manche X/5`
- T8.2.4 : Appliquer la charte graphique (fond #0a0e17, primaire #6366f1, accent #f59e0b, FORGE #DC2626, ARCANE #7C3AED, NATURE #16A34A)

### US 8.3 -- Page Carte de ressources

En tant que joueur, je veux voir et interagir avec la carte 3D.

**Tasks :**

- T8.3.1 : A l'entree sur `/map`, generer une nouvelle carte avec seed aleatoire (`POST /map/reset`) -- **deja fait**
- T8.3.2 : Afficher les nodes recoltables avec mesh par type de terrain (MUR/TROU/PLAT) -- **deja fait**
- T8.3.3 : Badge seed dans le header -- **deja fait**
- T8.3.4 : Clic sur un node : appel `POST /farming/gather`, animation, mise a jour pips
- T8.3.5 : HUD farming : 4 pips de recolte (plein/vide), compteur `Manche X/5`, bouton "Terminer la manche"

### US 8.4 -- Page Combat (avec reveal mannequins)

En tant que joueur, je veux une vue combat 3D avec HUD et panneaux mannequins.

**Tasks :**

- T8.4.1 : `CombatMapScene.tsx` : grille 20x20 copiee du seed, terrains MUR/TROU/PLAT, menhirs en volume
- T8.4.2 : Joueurs en capsules colorees (indigo vs ambre)
- T8.4.3 : Panneaux mannequins gauche (soi) et droite (adversaire) avec items equipes et stats revelees
- T8.4.4 : Highlight des cases de mouvement et de portee des sorts
- T8.4.5 : HUD : barre VIT, compteurs PA/PM, barre de 9 spells (pips de niveau, grise si cooldown/PA insuffisants)
- T8.4.6 : Indicateur de tour, bouton "Fin de tour", indicateur de buffs actifs (Endurance, Velocite + duree)

---

## EPIC 9 -- Evenements inter-equipes

> Communication entre Equipe A (Economy) et Equipe B (Combat) via NestJS EventEmitter.

### US 9.1 -- Emissions d'evenements (Equipe A)

En tant que membre de l'equipe combat, je veux etre notifie quand un joueur change d'equipement.

**Tasks :**

- T9.1.1 : Emettre `player.item.equipped` avec `{ playerId, itemId, slot }` dans `EquipmentService.equip()`
- T9.1.2 : Emettre `player.item.unequipped` avec `{ playerId, itemId, slot }` dans `EquipmentService.unequip()`
- T9.1.3 : Emettre `player.spells.changed` avec `{ playerId, spells: [{ spellId, level }] }` apres chaque recalcul
- T9.1.4 : Emettre `game.session.created` avec `{ sessionId, seedId, player1Id, player2Id }` au demarrage d'une partie

### US 9.2 -- Consommation d'evenements (Equipe A)

En tant que membre de l'equipe economie, je veux distribuer les recompenses quand un combat se termine.

**Tasks :**

- T9.2.1 : Ecouter `combat.ended` : crediter 50 or au `winnerId`
- T9.2.2 : Ecouter `combat.player.died` : (log ou tracking)

---

## Ordre de realisation recommande

1. **EPIC 1** (Fondations) -- bloquant pour tout le reste
2. **EPIC 2** (Carte) -- partiellement fait, a completer avec les features farming
3. **EPIC 3** (Farming) + **EPIC 6** (Shop) -- peuvent demarrer en parallele apres EPIC 1
4. **EPIC 4** (Equipement) + **EPIC 5** (Crafting) -- dependent de EPIC 1
5. **EPIC 7** (Combat) -- depend de EPIC 2 + EPIC 4
6. **EPIC 8** (UI) -- progressif, en parallele de chaque Epic backend
7. **EPIC 9** (Evenements) -- final, integration entre equipes

## Repartition par equipe

- **Equipe A** (World + Economy) : EPIC 1, 2, 3, 4, 5, 6, 8 (pages hors combat), 9.1, 9.2
- **Equipe B** (Combat) : EPIC 7, 8 (page combat + HUD)

| Feature | Statut |
|---------|--------|
| `TerrainType` (8 types), `CombatTerrainType`, `ResourceFamily` | **Fait** |
| `SEED_CONFIGS` (6 seeds) + `SeedId` | **Fait** |
| `MapGeneratorService` (generation par seed, clustering, connectivite) | **Fait** |
| `GET /map` + `POST /map/reset` | **Fait** |
| Rendu 3D des terrains (MUR/TROU/PLAT) | **Fait** |
| Pathfinding A* avec tie-breaker (staircase) + `canJumpOver` | **Fait** |
| Pion joueur + animation de deplacement | **Fait** |
| Panneau info terrain (bas gauche) | **Fait** |
| Badge seed dans le header | **Fait** |
| Generation nouvelle carte a chaque visite `/map` | **Fait** |
| Authentification (JWT) | **Fait** |
| Migration Prisma initiale + seed de test | **Fait** |
| **Optimisation Rendu Combat** : `CombatHighlightsLayer` (reachable tiles, spell range, path guide) | **Fait** |
| **Raycasting Robuste** : Throttled hover refresh via `useFrame` (independant des mouvements souris/camera) | **Fait** |
| **Decouplage Graphique** : Separation des highlights dynamiques de la grille statique (Zero re-renders de grille au hover) | **Fait** |
| **Pathfinding Aesthetique** : Algorithme A* ameliore pour favoriser les trajectoires "en escalier" naturelles | **Fait** |


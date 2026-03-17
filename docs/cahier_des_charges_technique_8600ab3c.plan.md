---
name: Cahier des charges technique
overview: Cahier des charges technique du jeu Dofus-Like, decoupant l'ensemble des fonctionnalites du GDD en Epics, User Stories et Tasks, ancre dans l'architecture existante (NX monorepo, NestJS, Prisma, React 19, Three.js).
todos:
  - id: epic1-schema
    content: "EPIC 1 : Refonte schema Prisma, types partages et seed"
    status: pending
  - id: epic2-map
    content: "EPIC 2 : Carte et terrain (generation, rendu 3D)"
    status: pending
  - id: epic3-farming
    content: "EPIC 3 : Farming de ressources (instances, recolte, rounds, respawn)"
    status: pending
  - id: epic4-equipment
    content: "EPIC 4 : Systeme d'items et equipement (mannequin, rangs, combos, spells)"
    status: pending
  - id: epic5-crafting
    content: "EPIC 5 : Systeme de crafting (Rang 1 + fusion)"
    status: pending
  - id: epic6-shop
    content: "EPIC 6 : Systeme de shop / economie (achat, vente, recompenses)"
    status: pending
  - id: epic7-combat
    content: "EPIC 7 : Combat PvP (sessions, tours, 9 spells, formules, victoire)"
    status: pending
  - id: epic8-ui
    content: "EPIC 8 : Interface utilisateur (pages, 3D, HUD)"
    status: pending
  - id: epic9-events
    content: "EPIC 9 : Evenements inter-equipes"
    status: pending
isProject: false
---

# Cahier des charges technique -- Dofus-Like

Le projet est un monorepo NX avec :

- **Backend** : NestJS + Prisma (PostgreSQL) + Redis + SSE -- `apps/api/`
- **Frontend** : React 19 + Vite + Three.js + Zustand + TanStack Query -- `apps/web/`
- **Types partagés** : `libs/shared-types/`

Le schema Prisma actuel utilise des stats obsolètes (`hp`, `strength`, `agility`), des `ItemType` incomplets (`WEAPON`, `ARMOR`, `RING`), un système `equipped: boolean` sur `InventoryItem` au lieu d'un mannequin a slots, et 3 spells en dur au lieu de 9 spells dynamiques. **Presque tout le modèle de données doit être refondu.**

---

## EPIC 1 -- Fondations (Refonte modele de donnees)

> Prerequis de tous les autres Epics. Refondre le schema Prisma, les types partagés et le seed pour correspondre au GDD.

### US 1.1 -- Refonte du schema Prisma

En tant que developpeur, je veux un schema de données aligné sur le GDD pour que toutes les features puissent s'appuyer dessus.

**Tasks :**

- T1.1.1 : Mettre a jour l'enum `ItemType` : `WEAPON`, `ARMOR_HEAD`, `ARMOR_CHEST`, `ARMOR_LEGS`, `ACCESSORY`, `CONSUMABLE`, `RESOURCE`
- T1.1.2 : Ajouter un champ `rank` (Int, default 1, range 1-3) sur le modele `Item` ou sur `InventoryItem` pour gerer les rangs d'armure/arme
- T1.1.3 : Ajouter un champ `grantsSpells` (Json, liste de spell IDs) sur le modele `Item`
- T1.1.4 : Remplacer le modele `PlayerStats` : `baseHp` -> `vit` (100), `strength` -> `atk` (5), ajouter `mag` (0), `def` (0), `res` (0), `ini` (10), `pa` (6), `pm` (3)
- T1.1.5 : Creer un modele `EquipmentSlot` avec les champs `playerId`, `slot` (enum: `WEAPON_LEFT`, `WEAPON_RIGHT`, `ARMOR_HEAD`, `ARMOR_CHEST`, `ARMOR_LEGS`, `ACCESSORY`), `inventoryItemId` (nullable FK)
- T1.1.6 : Supprimer le champ `equipped: Boolean` de `InventoryItem` (remplacé par `EquipmentSlot`)
- T1.1.7 : Supprimer le modele `PlayerSpell` et la table `Spell` en dur (les spells sont calcules dynamiquement a partir de l'equipement)
- T1.1.8 : Generer et appliquer la migration Prisma

### US 1.2 -- Refonte des types partagés

En tant que developpeur, je veux des interfaces TypeScript alignées sur les nouvelles stats et types d'items.

**Tasks :**

- T1.2.1 : Mettre a jour `ItemType` dans `libs/shared-types/src/player.types.ts`
- T1.2.2 : Mettre a jour `PlayerStats` : `{ vit, atk, mag, def, res, ini, pa, pm }`
- T1.2.3 : Ajouter `StatsBonus` interface : `{ vit?, atk?, mag?, def?, res?, ini?, pa?, pm? }`
- T1.2.4 : Ajouter `SpellId` enum avec les 9 spells, `SpellLevel` (1-3), `PlayerSpell` interface
- T1.2.5 : Ajouter `EquipmentSlotType` enum et `Equipment` interface
- T1.2.6 : Ajouter `TerrainType` enum (SOL, EAU, MINERAI_FER, MINERAI_OR, BOIS, HERBE, CRISTAL, CUIR)
- T1.2.7 : Ajouter `DamageChannel` enum (PHYSICAL, MAGICAL)
- T1.2.8 : Mettre a jour `CombatAction` avec `JUMP` en plus de `MOVE`, `CAST_SPELL`, `END_TURN`

### US 1.3 -- Seed complet du jeu

En tant que developpeur, je veux un seed conforme au GDD avec tous les items, ressources et recettes.

**Tasks :**

- T1.3.1 : Creer les 6 ressources (Bois de Frene, Minerai de Fer, Minerai d'Or, Herbe Medicinale, Cristal d'Ombre, Cuir Robuste)
- T1.3.2 : Creer les 6 armes Rang 1 (Epee, Bouclier, Baton Magique, Grimoire, Kunai, Bombe du Ninja) avec `statsBonus`, `grantsSpells`, `shopPrice`
- T1.3.3 : Creer les 9 armures Rang 1 (Heaume, Armure, Bottes de Fer, Chapeau de Mage, Toge de Mage, Bottes de Mage, Bandeau, Kimono, Geta) avec `statsBonus`, `craftCost`
- T1.3.4 : Creer les 3 anneaux (Anneau de Guerrier, Anneau du Mage, Anneau du Ninja) avec `statsBonus`, `grantsSpells`, `craftCost`
- T1.3.5 : Creer les 2 consommables (Potion de Soin, Barricade) avec `shopPrice` et `craftCost`
- T1.3.6 : Creer 2 joueurs de test avec inventaire, equipement et or

---

## EPIC 2 -- Carte et terrain

> Carte 20x20 partagée entre farming et combat avec types de terrain.

### US 2.1 -- Generation de la carte

En tant que joueur, je veux une carte 20x20 avec differents types de terrain pour que le gameplay soit varié.

**Tasks :**

- T2.1.1 : Creer un service `MapGeneratorService` qui genere une grille 20x20 avec placement procedural des terrains (eau, minerais, arbres, cristaux, herbes, cuir, sol libre)
- T2.1.2 : Stocker la carte de reference en base (ou en Redis) : `Map { id, grid: TerrainType[][] }`
- T2.1.3 : Endpoint `GET /map` retournant la grille avec types de terrain
- T2.1.4 : Definir les proprietes de chaque terrain (traversable, tirAuTravers, sautParDessus) dans une constante partagée

### US 2.2 -- Rendu 3D de la carte

En tant que joueur, je veux voir la carte en 3D isometrique avec des tuiles visuellement distinctes par type de terrain.

**Tasks :**

- T2.2.1 : Refactorer `ResourceMapScene.tsx` pour consommer le endpoint `GET /map` au lieu de donnees locales
- T2.2.2 : Creer un composant `TerrainTile` avec un mesh different par type (eau animee, roche metallique, arbre, cristal violet, buisson, depouille)
- T2.2.3 : Camera orthographique, vue de dessus

---

## EPIC 3 -- Farming de ressources

> Recolte de ressources dans des instances separees avec systeme de rounds et respawn.

### US 3.1 -- Instances de farming separees

En tant que joueur, je veux farmer dans ma propre instance pour que les autres joueurs n'affectent pas mes ressources.

**Tasks :**

- T3.1.1 : Creer un service `FarmingInstanceService` qui gere l'etat des nodes de ressources par joueur (Redis ou Prisma)
- T3.1.2 : A la premiere connexion a `/map`, initialiser l'instance du joueur a partir de la carte de reference
- T3.1.3 : Endpoint `GET /map/resources` retourne les nodes de l'instance du joueur (pas la carte globale)

### US 3.2 -- Recolte de ressources

En tant que joueur, je veux cliquer sur un node de ressource pour l'ajouter a mon inventaire.

**Tasks :**

- T3.2.1 : Refactorer `POST /map/resources/:id/gather` pour travailler avec l'instance du joueur
- T3.2.2 : Verifier que le joueur est adjacent au node (distance Manhattan = 1) ou sur le node (herbe/cuir)
- T3.2.3 : Ajouter la ressource a l'inventaire (quantite +1), retirer le node de l'instance
- T3.2.4 : Frontend : highlight du node au survol, clic declenchant l'appel API, animation de recolte

### US 3.3 -- Systeme de Rounds et Respawn

En tant que joueur, je veux que les ressources reapparaissent pour pouvoir continuer a farmer.

**Tasks :**

- T3.3.1 : Tracker le compteur de Rounds par instance (incremente toutes les 5 recoltes ou via bouton)
- T3.3.2 : Au passage de Round, faire respawn des ressources communes (cooldown +1 Round)
- T3.3.3 : Faire respawn des ressources rares (cooldown +3 Rounds)
- T3.3.4 : Frontend : afficher le compteur de Rounds et le bouton "Passer au Round suivant"

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
- T4.3.3 : Stocker les stats effectives en cache (Redis) pour les lectures rapides
- T4.3.4 : Invalider le cache a chaque changement d'equipement

### US 4.4 -- Detection combos, full sets et calcul des spells

En tant que joueur, je veux que mes spells se debloquent et montent en niveau automatiquement selon mes combos d'items.

**Tasks :**

- T4.4.1 : Creer `SpellResolverService.resolveSpells(equipment)` qui retourne `Map<SpellId, level>`
- T4.4.2 : Implementer la detection des 3 combos d'armes : Epee+Bouclier, Baton+Grimoire, Kunai+Bombe du Ninja
- T4.4.3 : Implementer la detection des 3 Full Sets : Guerrier (Heaume+Armure+Bottes de Fer), Mage (Chapeau+Toge+Bottes de Mage), Ninja (Bandeau+Kimono+Geta)
- T4.4.4 : Implementer le comptage de sources : chaque source distincte (item seul, combo, full set, anneau) ajoute +1 au niveau du spell, max 3
- T4.4.5 : Emettre l'evenement `player.spells.changed` a chaque recalcul

### US 4.5 -- Rangs d'items (fusion / merge)

En tant que joueur, je veux pouvoir fusionner 2 items identiques de meme rang pour obtenir le rang superieur.

**Tasks :**

- T4.5.1 : Ajouter la logique de merge dans `CraftingService` : verifier 2x meme item meme rang en inventaire, consommer les deux, creer l'item au rang +1
- T4.5.2 : Si l'un des items est equipe, bloquer le merge (ou desequiper automatiquement)
- T4.5.3 : Endpoint `POST /crafting/merge` avec `{ itemId, currentRank }`
- T4.5.4 : Frontend : dans la page crafting, onglet "Fusion" montrant les merges possibles

---

## EPIC 5 -- Systeme de crafting

> Fabrication d'items Rang 1 et consommables a partir de ressources.

### US 5.1 -- Craft d'items Rang 1

En tant que joueur, je veux crafter des armures, armes et anneaux a partir de ressources recoltées.

**Tasks :**

- T5.1.1 : Mettre a jour `CraftingService.craft()` pour lire `craftCost` de l'item et verifier les ressources du joueur
- T5.1.2 : Transaction atomique : deduire les ressources, creer l'item dans l'inventaire (rang 1)
- T5.1.3 : Endpoint existant `POST /crafting/craft` reste identique

### US 5.2 -- Page crafting (Frontend)

En tant que joueur, je veux une interface de crafting organisee par archetype.

**Tasks :**

- T5.2.1 : Creer `CraftingPage.tsx` (route `/crafting`)
- T5.2.2 : 4 onglets : Guerrier, Mage, Ninja, Consommables
- T5.2.3 : Pour chaque recette : nom de l'item, ingredients requis (avec quantite possedee), stats bonus, bouton "Crafter" (desactive si ressources insuffisantes)
- T5.2.4 : Section "Fusion" : liste des items fusionnables (2x meme item meme rang)

---

## EPIC 6 -- Systeme de shop / economie

> Boutique PNJ avec achat et vente.

### US 6.1 -- Achat d'items

En tant que joueur, je veux acheter des armes et consommables au shop.

**Tasks :**

- T6.1.1 : Verifier que `ShopService.buy()` fonctionne avec les nouveaux items (6 armes + 2 consommables en shop)
- T6.1.2 : Frontend : cabler le bouton "Acheter" dans `ShopPage.tsx` (actuellement non cable)
- T6.1.3 : Afficher l'or du joueur et les stats bonus de chaque item dans les cartes

### US 6.2 -- Vente d'items

En tant que joueur, je veux vendre des items de mon inventaire pour recuperer de l'or.

**Tasks :**

- T6.2.1 : `ShopService.sell()` : prix de vente = 50% du `shopPrice`, verifier que l'item n'est pas equipe
- T6.2.2 : Frontend : bouton "Vendre" dans l'inventaire et dans le shop
- T6.2.3 : Confirmation avant vente (modal)

### US 6.3 -- Recompenses de combat

En tant que joueur vainqueur, je veux recevoir 50 or et potentiellement du loot.

**Tasks :**

- T6.3.1 : Ecouter l'evenement `combat.ended` dans `EconomyModule`
- T6.3.2 : Crediter 50 or au vainqueur
- T6.3.3 : (Optionnel) Loot aleatoire : ressource commune ou rare

---

## EPIC 7 -- Combat PvP

> Systeme de combat au tour par tour sur grille.

### US 7.1 -- Sessions de combat

En tant que joueur, je veux defier un autre joueur et que le combat se lance sur une copie de la carte de farm.

**Tasks :**

- T7.1.1 : Refactorer `SessionService` pour copier la grille 20x20 (depuis la carte de reference) au lancement du combat
- T7.1.2 : Stocker l'etat du combat en Redis : grille, positions des joueurs, HP, buffs, cooldowns, menhirs
- T7.1.3 : Placer les joueurs sur des zones de spawn predefinies (coins opposes)
- T7.1.4 : Charger les stats effectives et les spells de chaque joueur (depuis `StatsCalculatorService` et `SpellResolverService`)

### US 7.2 -- Systeme de tours

En tant que joueur, je veux jouer tour par tour avec AP et PM reinitialises a chaque tour.

**Tasks :**

- T7.2.1 : Implementer le tour loop : alternance des joueurs, reinitialisation AP/PM, decrementation cooldowns
- T7.2.2 : Annuler les effets temporaires au debut de chaque tour (barricades)
- T7.2.3 : Decrementer les durees des buffs (Endurance, Velocite) et menhirs
- T7.2.4 : SSE : pousser l'etat mis a jour aux deux joueurs apres chaque action

### US 7.3 -- Deplacement et saut

En tant que joueur, je veux me deplacer sur la grille et sauter par-dessus l'eau.

**Tasks :**

- T7.3.1 : Action `MOVE` : 1 PM par case, mouvement Manhattan, verifier que la case est traversable
- T7.3.2 : Action `JUMP` : 1 PM, sauter par-dessus une mare d'eau adjacente, atterrir de l'autre cote (case libre requise)
- T7.3.3 : Frontend : highlight des cases accessibles au clic sur le joueur

### US 7.4 -- Ligne de vue

En tant que joueur, je veux que les sorts respectent la ligne de vue.

**Tasks :**

- T7.4.1 : Implementer l'algorithme de ligne de vue (raycasting sur grille) : minerais, arbres, cristaux et menhirs bloquent la LdV
- T7.4.2 : Eau, herbes, cuir ne bloquent pas
- T7.4.3 : Frontend : au survol d'une case, afficher si elle est a portee ET en ligne de vue

### US 7.5 -- Initiative

En tant que joueur, je veux que l'ordre du premier tour soit determine par l'initiative.

**Tasks :**

- T7.5.1 : Au debut du combat, calculer `score = INI + random(0, 9)` pour chaque joueur
- T7.5.2 : Le joueur avec le score le plus eleve joue en premier

### US 7.6 -- Les 9 spells (effets)

En tant que joueur, je veux lancer mes sorts avec des effets correspondant a leur niveau.

**Tasks :**

- T7.6.1 : Definir les 9 spells dans une constante `SPELL_DEFINITIONS` avec stats par niveau (cout PA, portee, degats, cooldown, special)
- T7.6.2 : **Frappe** : degats physiques CaC, lvl 3 ignore 50% DEF
- T7.6.3 : **Bond** : teleportation de 2/3/4 cases, ignore obstacles et eau
- T7.6.4 : **Endurance** : buff DEF +3/+5/+8 pendant 2/2/3 tours
- T7.6.5 : **Menhir** : invoque un obstacle temporaire (bloque mouvement + LdV), duree 2/3/3 tours, lvl 3 = 2 menhirs
- T7.6.6 : **Boule de Feu** : degats magiques distance, lvl 3 = AoE (4 cases adjacentes, 50% degats)
- T7.6.7 : **Lancer de Kunai** : degats physiques distance, lvl 3 = 2 lancers par tour
- T7.6.8 : **Bombe de Repousse** : degats physiques + repousse 1/2/3 cases, lvl 3 = degats bonus si collision
- T7.6.9 : **Velocite** : buff PM +2/+3/+4 pendant 1/2/2 tours, lvl 3 = INI +5
- T7.6.10 : **Soin** : heal magique (scaling 50% MAG)

### US 7.7 -- Formules de degats

En tant que joueur, je veux que les degats soient calcules correctement selon le canal physique ou magique.

**Tasks :**

- T7.7.1 : Implementer la formule physique : `degats_finaux = max(1, degats_base + ATK - DEF_cible)`
- T7.7.2 : Implementer la formule magique : `degats_finaux = max(1, degats_base + MAG - RES_cible)`
- T7.7.3 : Implementer la formule soin : `soin_effectif = soin_base + floor(MAG * 0.5)`

### US 7.8 -- Condition de victoire et recompenses

En tant que joueur, je veux que le combat se termine quand un joueur tombe a 0 VIT.

**Tasks :**

- T7.8.1 : Verifier VIT <= 0 apres chaque action de degats
- T7.8.2 : Declarer le vainqueur, emettre `combat.ended` et `combat.player.died`
- T7.8.3 : Rediriger les deux joueurs vers le lobby

---

## EPIC 8 -- Interface utilisateur

> Pages frontend, composants 3D, HUD.

### US 8.1 -- Page Login

En tant que joueur, je veux m'inscrire et me connecter.

**Tasks :**

- T8.1.1 : Verifier que `LoginPage.tsx` fonctionne avec le backend actuel (deja implementé)

### US 8.2 -- Page Lobby

En tant que joueur, je veux un hub central avec mes infos et la navigation.

**Tasks :**

- T8.2.1 : Afficher or, pseudo, stats effectives (8 stats), spells actifs avec niveau
- T8.2.2 : 5 boutons de navigation : Carte, Boutique, Inventaire, Crafting, Combat
- T8.2.3 : Appliquer la charte graphique (fond #0a0e17, primaire #6366f1, accent #f59e0b)

### US 8.3 -- Page Carte de ressources

En tant que joueur, je veux voir et interagir avec la carte 3D.

**Tasks :**

- T8.3.1 : Refactorer `ResourceMapScene.tsx` pour charger la grille depuis l'API
- T8.3.2 : Afficher les nodes récoltables avec mesh par type de terrain
- T8.3.3 : Clic sur un node : appel `POST /map/resources/:id/gather`, animation, mise a jour
- T8.3.4 : Compteur de Rounds + bouton "Passer au Round suivant"

### US 8.4 -- Page Combat

En tant que joueur, je veux une vue combat 3D avec HUD.

**Tasks :**

- T8.4.1 : `CombatMapScene.tsx` : grille 20x20 avec terrain copie de la farm, menhirs en volume
- T8.4.2 : Joueurs en capsules colorées (indigo vs ambre)
- T8.4.3 : Highlight des cases de mouvement et de portee des sorts
- T8.4.4 : HUD : barre VIT, compteurs PA/PM, barre de 9 spells (pips de niveau, grise si cooldown/PA insuffisants)
- T8.4.5 : Indicateur de tour, bouton "Fin de tour", indicateur de buffs actifs

---

## EPIC 9 -- Evenements inter-equipes

> Communication entre Equipe A (Economy) et Equipe B (Combat) via NestJS EventEmitter.

### US 9.1 -- Emissions d'evenements (Equipe A)

En tant que membre de l'equipe combat, je veux etre notifié quand un joueur change d'equipement.

**Tasks :**

- T9.1.1 : Emettre `player.item.equipped` avec `{ playerId, itemId, slot }` dans `EquipmentService.equip()`
- T9.1.2 : Emettre `player.item.unequipped` avec `{ playerId, itemId, slot }` dans `EquipmentService.unequip()`
- T9.1.3 : Emettre `player.spells.changed` avec `{ playerId, spells: [{ spellId, level }] }` apres chaque recalcul

### US 9.2 -- Consommation d'evenements (Equipe A)

En tant que membre de l'equipe economie, je veux distribuer les recompenses quand un combat se termine.

**Tasks :**

- T9.2.1 : Ecouter `combat.ended` : crediter 50 or au `winnerId`
- T9.2.2 : Ecouter `combat.player.died` : (log ou tracking)

---

## Ordre de realisation recommandé

1. **EPIC 1** (Fondations) -- bloquant pour tout le reste
2. **EPIC 2** (Carte) + **EPIC 6** (Shop) -- peuvent demarrer en parallele
3. **EPIC 3** (Farming) -- depend de EPIC 2
4. **EPIC 4** (Equipement) + **EPIC 5** (Crafting) -- dependent de EPIC 1
5. **EPIC 7** (Combat) -- depend de EPIC 2 + EPIC 4
6. **EPIC 8** (UI) -- progressif, en parallele de chaque Epic backend
7. **EPIC 9** (Evenements) -- final, integration entre equipes

## Repartition par equipe

- **Equipe A** (World + Economy) : EPIC 1, 2, 3, 4, 5, 6, 8 (pages hors combat), 9.1, 9.2
- **Equipe B** (Combat) : EPIC 7, 8 (page combat + HUD)

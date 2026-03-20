# Tickets d'Implémentation : Système de Combat

Ce document regroupe les tickets de développement et les user stories pour l'équipe en charge du système de combat (Équipe B), basés sur le Game Design Document.

---

## ÉPIC 1 : Fondations de l'Arène et du Moteur de Jeu

### [COMBAT-001] Génération de l'Arène de Combat dans Redis
**Description :** Lors de l'acceptation d'un défi, le système doit créer une copie figée (snapshot) de l'instance de la carte de farm du joueur et la stocker en mémoire cache.
**Critères d'acceptation :**
- Récupérer l'état de la grille 20x20.
- Conserver les types de terrains et leurs propriétés quantitatives (eau, arbres, minerais, etc.).
- Placer le Joueur 1 et le Joueur 2 dans leurs zones de spawn respectives.
- Initialiser l'état du combat (`CombatState` défini dans `@game/shared-types`) dans **Redis**.
- S'assurer que la carte de combat n'évolue pas avec le farming (pas de respawn).

### [COMBAT-002] Initialisation des Joueurs et Système de Tours (Redis / API)
**Description :** Le combat doit se dérouler au tour par tour (round-robin), basé sur l'Initiative (INI).
**Critères d'acceptation :**
- Charger les stats effectives des joueurs (via `PlayerStatsService`) depuis les événements stockés suite aux actions de l'Équipe A.
- Déterminer le premier joueur à agir avec le jet d'Initiative (`score = INI + random(0, 9)`).
- Gérer le cycle de tour dans **Redis** :
  - Au début de son tour, le joueur récupère tous ses PA et PM.
  - Décrémenter les cooldowns des sorts et la durée des buffs.
  - Annuler les menhirs/barricades si leur durée expire au début du tour.
- Émettre un évènement SSE `TURN_STARTED` aux deux clients.

### [COMBAT-003] Algorithme de Ligne de Vue (libs/game-engine)
**Description :** Implémenter l'algorithme agnostique de ligne de vue (Line of Sight - LoS) dans la librairie partagée.
**Critères d'acceptation :**
- Calculer une droite entre la case d'origine et la case ciblée dans `libs/game-engine`.
- Vérifier si des entités bloquantes sont sur la trajectoire (Minerais, Arbres, Cristaux, Menhirs).
- L'eau et les petites ressources (herbes/cuir) ne bloquent pas la vue.
- Retourner un boolean utilisable à la fois par le validator NestJS API et le frontend UI.

---

## ÉPIC 2 : Actions et Mouvements

### [COMBAT-004] Déplacements Classiques dans l'Engine
**Description :** Permettre aux joueurs de se déplacer sur la grille en dépensant des Points de Mouvement (PM).
**Critères d'acceptation :**
- Coder la fonction `movePlayer(state, player, targetTile)` dans `lib/game-engine`.
- Vérifier que la case de destination est libre (pas d'obstacle, d'eau ou de joueur).
- Calculer la distance de Manhattan.
- Déduire le bon nombre de PM et mettre à jour la BDD temps réel (**Redis**).
- Impossible de se déplacer en diagonale.
- Émettre un SSE `STATE_UPDATED`.

### [COMBAT-005] Déplacement Spécial (JUMP)
**Description :** Ajouter la mécanique de saut par-dessus l'eau ou petit obstacle adjacents (si applicable).
**Critères d'acceptation :**
- Permettre l'action "Saut" si une mare d'eau est adjacente et que la case de l'autre côté est libre.
- Dépense 1 PM.
- Interdire le saut par-dessus les gros obstacles (roches, arbres) sans le sort spécifique "Bond".

---

## ÉPIC 3 : Compétences et Dégâts

### [COMBAT-006] Bibliothèque de Dégâts (libs/game-engine)
**Description :** Mettre en place les fonctions pures pour la résolution des sorts.
**Critères d'acceptation :**
- Valider le coût en PA, la distance (Manhattan) et cooldowns dans la logique pure métier.
- Formule Physique : `(Dégâts de base + ATK) - DEF`.
- Formule Magique : `(Dégâts de base + MAG) - RES`.
- Formule Soins : `Soin de base + (MAG * 0.5)`.
- La fonction retourne un delta (dégâts, effets statuts) qui sera appliqué sur l'état **Redis** par le contrôleur API.

### [COMBAT-007] Implémentation des 3 Sorts de Dégâts Communs [DONE]
**Description :** Intégrer les attaques classiques dans le moteur de sorts, selon leur rang (R1 à R3).
**Critères d'acceptation :**
- **Frappe** : Dégâts physiques au CaC. Ignore de l'armure au rang 3.
- **Boule de Feu** : Dégâts magiques à distance. Dégâts de zone à 50% au rang 3.
- **Lancer de Kunaï** : Dégâts physiques à mi-distance. Possibilité de lancer 2 fois par tour au rang 3.

### [COMBAT-008] Mécaniques de Sorts Spéciaux Spatiaux
**Description :** Coder les compétences modifiant le positionnement (Bond et Bombe de Repousse) et créant des obstacles (Menhir).
**Critères d'acceptation :**
- **Bond** : Téléportation de N cases (ignore pièges et terrains).
- **Bombe de Repousse** : Pousse la cible dans la direction du lanceur. Ajouter +50% de dégâts si la cible heurte un mur/obstacle au rang 3.
- **Menhir** : Créer une entité temporaire (bloque vue et mouvement) qui dure N tours.

### [COMBAT-009] Gestion des Buffs (Sorts Actifs)
**Description :** Permettre l'application d'effets bénéfiques sur le lanceur.
**Critères d'acceptation :**
- **Endurance** : Appliquer un statut augmentant la DEF pour X tours.
- **Vélocité** : Appliquer un statut augmentant les PM (et l'INI au rang 3) pour X tours.
- Gérer la fin des effets (retour aux stats normales automatiques).

---

## ÉPIC 4 : Fin de Combat et Intégration

### [COMBAT-010] Event-Emitter de victoire (Couplage inter-équipes)
**Description :** Gérer la fin de la boucle de gameplay d'un combat et notifier l'équipe A via les events NestJS.
**Critères d'acceptation :**
- Détecter si la VIT d'un joueur tombe à <= 0.
- Transmettre l'Event `COMBAT_ENDED` (défini dans `libs/shared-types`) à l'Event Bus NestJS, avec le payload `{ sessionId, winnerId, loserId }`.
- (Optionnel) Émettre `COMBAT_PLAYER_DIED` au cas où ça pop up côté stats/log admin.
- Fermer le scope temps réel, détruire l'état dans **Redis** et clore la session SSE des deux clients.

### [COMBAT-011] Frontend de Combat (Zustand & Three.js) [DONE]
**Description :** Connecter l'interface de combat côté web au Stream SSE.
**Critères d'acceptation :**
- Initialiser un Store Zustand (`useCombatStore`) qui se branche aux événements émis depuis le back (Server-Sent Events).
- Intégrer les variables d'UI : Barres de vie, PA, PM.
- Pousser l'état Zustand vers la `CombatMapScene` sous `@react-three/fiber` (Rendu isométrique 3D de l'arène).
- Utiliser la lib partagée `@game/game-engine` pour pré-calculer la ligne de vue (Highlight Rouge vs Highlight Vert) sur l'UI côté front sans requête backend.
- Lancer les actions formelles (déplacement, attack) via des requêtes HTTP (ex: Axios POST `/combat/action`) qui mettront à jour le serveur, lequel relancera un point d'entrée SSE.

---

## ÉPIC 5 : Polissage et Cosmétique

### [COMBAT-012] Système de Sélection de Skins [DONE]
**Description :** Permettre aux joueurs de choisir une apparence personnalisée dans le lobby.
**Critères d'acceptation :**
- Implémenter une grille de sélection de skins (Guerriers et Orcs) dans le Lobby.
- Sauvegarder le choix en BDD (Prisma) et le synchroniser dans le `CombatState`.
- Appliquer des filtres CSS dynamiques (teinte, saturation) sur les sprites 3D et les portraits du HUD.

### [COMBAT-013] Calibration des Projectiles (VFX) [DONE]
**Description :** Assurer la fidélité visuelle des effets de sorts.
**Critères d'acceptation :**
- Développer un outil de calibration (VFX Calibrator) pour ajuster les offsets de rotation des projectiles.
- Calibrer définitivement la flèche du Kunaï à un angle de -0.80 rad pour un rendu réaliste.
- Supprimer les outils de debug après validation.

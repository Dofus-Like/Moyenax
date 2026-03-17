# Tickets d'Implémentation : Système de Combat

Ce document regroupe les tickets de développement et les user stories pour l'équipe en charge du système de combat (Équipe B), basés sur le Game Design Document.

---

## ÉPIC 1 : Fondations de l'Arène et du Moteur de Jeu

### [COMBAT-001] Génération de l'Arène de Combat
**Description :** Lors de l'acceptation d'un défi, le système doit créer une copie figée (snapshot) de l'instance de la carte de farm du joueur.
**Critères d'acceptation :**
- Récupérer l'état de la grille 20x20.
- Conserver les types de terrains et leurs propriétés (eau, arbres, minerais, etc.).
- Placer le Joueur 1 et le Joueur 2 dans leurs zones de spawn respectives.
- S'assurer que les nodes récoltés ou disparus du farm ne réapparaissent pas en plein combat.

### [COMBAT-002] Initialisation des Joueurs et Système de Tours
**Description :** Le combat doit se dérouler au tour par tour (round-robin), basé sur l'Initiative (INI).
**Critères d'acceptation :**
- Charger les stats effectives des joueurs (VIT, ATK, MAG, DEF, RES, INI, PA, PM) depuis leur équipement (Équipe A).
- Déterminer le premier joueur à agir avec le jet d'Initiative (`score = INI + random(0, 9)`).
- Gérer le cycle de tour :
  - Au début de son tour, le joueur récupère tous ses PA et PM.
  - Décrémenter les cooldowns des sorts et la durée des buffs.
  - Annuler les menhirs/barricades si leur durée expire au début du tour.

### [COMBAT-003] Ligne de Vue (Line of Sight - LoS)
**Description :** Implémenter l'algorithme de ligne de vue pour les attaques à distance.
**Critères d'acceptation :**
- Calculer une droite entre la case du lanceur et la case ciblée.
- Vérifier si des entités bloquantes sont sur la trajectoire (Minerais, Arbres, Cristaux, Menhirs).
- L'eau et les petites ressources (herbes/cuir) ne bloquent pas la vue.
- Retourner une erreur explicite côté front ("Ligne de vue bloquée") si le joueur tente de cibler.

---

## ÉPIC 2 : Actions et Mouvements

### [COMBAT-004] Déplacements Classiques (MOVE)
**Description :** Permettre aux joueurs de se déplacer sur la grille en dépensant des Points de Mouvement (PM).
**Critères d'acceptation :**
- Vérifier que la case de destination est libre (pas d'obstacle, d'eau ou de joueur).
- Calculer la distance de Manhattan.
- Déduire 1 PM par case parcourue.
- Impossible de se déplacer en diagonale.

### [COMBAT-005] Déplacement Spécial (JUMP)
**Description :** Ajouter la mécanique de saut par-dessus l'eau ou petit obstacle adjacents (si applicable).
**Critères d'acceptation :**
- Permettre l'action "Saut" si une mare d'eau est adjacente et que la case de l'autre côté est libre.
- Dépense 1 PM.
- Interdire le saut par-dessus les gros obstacles (roches, arbres) sans le sort spécifique "Bond".

---

## ÉPIC 3 : Compétences et Dégâts

### [COMBAT-006] Moteur de Sorts : Calculs de dommages et soins
**Description :** Mettre en place la fonction de base pour la résolution des sorts lancés.
**Critères d'acceptation :**
- Prendre en compte le coût en PA, la distance (Manhattan) par rapport à la portée autorisée du sort et les cooldowns.
- Canal Physique : `(Dégâts de base + ATK) - DEF`.
- Canal Magique : `(Dégâts de base + MAG) - RES`.
- Soins : `Soin de base + (MAG * 0.5)`.
- Mettre à jour la Vitalité (VIT) de la cible sans descendre sous 0.

### [COMBAT-007] Implémentation des 3 Sorts de Dégâts Communs
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

### [COMBAT-010] Détection de victoire et Inter-Équipes
**Description :** Gérer la fin de la boucle de gameplay d'un combat et notifier l'autre équipe.
**Critères d'acceptation :**
- Détecter si la VIT d'un joueur tombe à <= 0.
- Stopper le système de boucle de tours.
- Émettre l'événement backend `combat.ended` avec l'`Id` du vainqueur et du perdant.
- Émettre `combat.player.died` si besoin de feed temps réel pour le front.
- Clôturer l'instance (garbage collection de l'arène).

### [COMBAT-011] UI HUD de Combat (Frontend)
**Description :** Créer l'interface de combat côté client.
**Critères d'acceptation :**
- Barres de vie, PA, PM.
- Rendu isométrique 3D de l'arène (`CombatMapScene`).
- Barre d'action affichant la liste des sorts disponibles (récupérée de l'inventaire/stats actuelles).
- Highlight des cases pour déplacement et prévisualisation des attaques.
- Bouton clair pour passer son tour.

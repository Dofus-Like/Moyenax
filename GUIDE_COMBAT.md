# 🎮 Guide : Comment Lancer un Combat

## ✅ Authentification Réactivée

L'authentification a été remise en place. Vous devez maintenant vous connecter pour accéder au jeu.

## 🚀 Étapes pour Lancer un Combat

### 1. Démarrer les Services

Assurez-vous que l'API et le frontend sont lancés :

```bash
yarn dev
```

Cela démarre :
- **Backend (API)** : `http://localhost:3000`
- **Frontend (Web)** : `http://localhost:5173`

### 2. Se Connecter

Allez sur `http://localhost:5173` et connectez-vous avec l'un des comptes de test :

| Compte | Email | Mot de passe |
|--------|-------|--------------|
| **Warrior** | `warrior@test.com` | `password123` |
| **Mage** | `mage@test.com` | `password123` |

> **Note** : Les comptes sont créés lors du seed (`yarn db:seed`)

### 3. Lancer un Combat

Une fois connecté, vous arrivez sur le **Lobby**. Vous avez plusieurs options :

#### Option A : Combat Test (Recommandé pour tester)

1. Dans le Lobby, cliquez sur la carte **"Combat Test"** (⚔️)
2. Cela lance automatiquement un combat contre le compte "Mage" du seed
3. Vous êtes redirigé vers `/combat/{sessionId}`

#### Option B : Navigation Directe (Pour déboguer)

Si vous connaissez un `sessionId` existant, vous pouvez accéder directement à :
```
http://localhost:5173/combat/{sessionId}
```

## 🎯 Que Voir dans le Combat ?

Une fois dans l'arène de combat, vous verrez :

### Graphismes Améliorés ✨

- **Personnages** : 
  - Le joueur actuel (vous) : **Bleu indigo** par défaut
  - L'adversaire : **Orange**
  - Corps + tête avec couleurs distinctes
  - Ombres portées au sol

- **Terrain** :
  - Tuiles en 3D avec relief
  - Ressources métalliques (Fer, Or) avec effet `metalness`
  - Cristaux brillants avec faible `roughness`
  - Bois cylindrique au lieu de cubes
  - Ombres réalistes

- **Éclairage** :
  - `ambientLight` à 0.5
  - `hemisphereLight` (ciel bleu / sol brun)
  - `directionalLight` avec ombres

- **Effets Visuels** :
  - **Boule de Feu** : 30 particules oranges/rouges en trail
  - **Sorts de Soin** : 40 particules vertes montantes
  - **Attaques physiques** : 15 particules blanches

### Interface

- **HUD en haut** : PV, PM, PA du tour actuel
- **Nom du joueur** au-dessus des personnages
- **Indicateur de tour** : Cône jaune au-dessus du joueur actif
- **Chemin de déplacement** : Aperçu bleu lors du survol d'une case

## 🐛 Dépannage

### Erreur "Assurez-vous d'avoir lancé le seed"

Si vous voyez cette erreur en cliquant sur "Combat Test", c'est que la base de données n'a pas les joueurs de test.

**Solution** :
```bash
yarn db:seed
```

### Erreur 502 (Bad Gateway)

Cela signifie que le backend a crashé. Vérifiez les logs du terminal où tourne `yarn dev`.

**Solution** :
```bash
# Redémarrer les services
yarn dev
```

### Combat ne se lance pas

1. Vérifiez que Redis est lancé :
```bash
docker ps
# Vous devriez voir "redis:7-alpine"
```

2. Si Redis n'est pas lancé :
```bash
docker-compose up -d
```

### Page blanche après connexion

Ouvrez la console du navigateur (F12) pour voir les erreurs. C'est probablement :
- L'API n'est pas démarrée
- Un problème de CORS (peu probable en dev)
- Le token JWT est invalide

**Solution** : Déconnectez-vous et reconnectez-vous.

## 📝 Notes Techniques

### Architecture Combat

- **Backend** : L'état du combat est stocké dans **Redis** pour la performance
- **Temps réel** : Utilise **SSE** (Server-Sent Events) pour notifier les changements
- **Frontend** : React Three Fiber pour le rendu 3D
- **Logique** : Les calculs de mouvement, sorts, etc. sont dans `@game/game-engine`

### URL du Combat

Format : `/combat/{sessionId}`
- Le `sessionId` est généré par le backend lors du `POST /combat/start-test`
- Il est unique par session de combat
- Il est stocké dans Redis avec un TTL (expiration)

### Système de Couleurs (Nouvellement Implémenté)

Les couleurs des personnages sont gérées par `apps/web/src/game/utils/playerColors.ts` :

```typescript
FORGE (Guerrier)  : Rouge/Orange métallique
ARCANE (Mage)     : Violet/Bleu
NATURE (Ninja)    : Vert/Brun
NEUTRAL (Défaut)  : Bleu indigo
```

Pour l'instant, tous les joueurs ont la couleur NEUTRAL. Le système analysera l'équipement plus tard pour déterminer l'archétype dominant.

## 🎨 Prochaines Améliorations Graphiques

Le système actuel utilise des couleurs pour différencier les classes. Les prochaines étapes pourraient inclure :

1. **Analyse de l'équipement** : Déterminer automatiquement la classe (Guerrier/Mage/Ninja) selon les items équipés
2. **Armes visibles** : Afficher l'épée, le bâton ou les kunai sur le personnage
3. **Armures distinctes** : Changer la géométrie selon l'armure équipée
4. **Animations** : Ajouter des animations d'attaque, de marche, etc.

## 🔗 Liens Utiles

- **Lobby** : `http://localhost:5173/lobby`
- **Carte des Ressources** : `http://localhost:5173/map`
- **Boutique** : `http://localhost:5173/shop`
- **Inventaire** : `http://localhost:5173/inventory`
- **API Docs** : Le backend n'expose pas de Swagger, mais vous pouvez voir les routes dans `apps/api/src/`

## 🎉 Bon Combat !

Vous êtes maintenant prêt à tester le système de combat avec les nouveaux graphismes améliorés (couleurs, ombres, particules, éclairage) !

# Guide de deploiement — CI/CD vers Portainer

Ce document explique comment configurer le pipeline CI/CD qui deploie automatiquement
la branche `main` sur ton instance Portainer (`roketlab.duckdns.org:9443`).

---

## Architecture du deploiement

```
Push sur main
    │
    ▼
GitHub Actions
    ├── Job 1 : Build image API  → ghcr.io/roketag33/moyenax-api:<sha>
    ├── Job 1 : Build image Web  → ghcr.io/roketag33/moyenax-web:<sha>
    │
    └── Job 2 : Portainer API (upsert)
            ├── Stack inexistante → POST /api/stacks/create  (1er deploy)
            └── Stack existante  → PUT  /api/stacks/{id}     (deploys suivants)

URLs finales :
  API : https://moyenax-api.roketlab.duckdns.org
  Web : https://moyenax.roketlab.duckdns.org
```

---

## Etape 1 — Configurer l'acces GHCR dans Portainer

Les images buildees par GitHub Actions sont stockees sur GHCR (GitHub Container Registry).
Portainer doit pouvoir les pull. Deux options :

### Option A — Rendre les packages GHCR publics (recommande pour un projet perso)

Apres le premier push sur main (qui cree les images), pour chaque package :

1. `https://github.com/roketag33?tab=packages`
2. Cliquer sur `moyenax-api` → Package settings → Change visibility → **Public**
3. Repeter pour `moyenax-web`

### Option B — Configurer le registry prive dans Portainer

1. Dans Portainer → Settings → Registries → Add registry
2. Choisir **GitHub Container Registry**
3. Remplir :
   - Username : `roketag33`
   - Personal Access Token : un PAT GitHub avec le scope `read:packages`
     (generer sur `https://github.com/settings/tokens`)
4. Sauvegarder

---

## Etape 2 — Generer un API token Portainer

1. Dans Portainer : ton profil (icone en haut a droite) → **Access tokens**
2. Add access token → copier la valeur (affichee une seule fois)

---

## Etape 3 — Recuperer l'endpoint ID Portainer

L'endpoint ID de l'environnement `local` est **3**.
(Verifie via : Settings → Environments si ca change un jour)

---

## Etape 4 — Configurer les secrets GitHub Actions

Aller sur : `https://github.com/roketag33/Dofus-Like/settings/secrets/actions`

Ajouter ces 6 secrets :

| Secret                   | Valeur                                      |
|--------------------------|---------------------------------------------|
| `PORTAINER_URL`          | `https://roketlab.duckdns.org:9443`         |
| `PORTAINER_API_TOKEN`    | Le token genere a l'etape 2                 |
| `PORTAINER_STACK_NAME`   | `moyenax`                                |
| `PORTAINER_ENDPOINT_ID`  | `3`                                         |
| `JWT_SECRET`             | Une chaine aleatoire longue (min 32 chars)  |
| `POSTGRES_PASSWORD`      | Un mot de passe fort pour la base de prod   |

Note : `GITHUB_TOKEN` est injecte automatiquement — pas besoin de le configurer.

---

## Etape 5 — Premier deploiement

Une fois les secrets configures, le premier deploiement se declenche automatiquement
au prochain push sur `main`. Le workflow va :

1. Builder et pusher les images sur GHCR
2. Creer la stack `moyenax` dans Portainer (si elle n'existe pas)
3. Demarrer tous les containers

Si tu as choisi **l'Option A** (packages publics), fais d'abord le push pour creer
les images, rends-les publiques, puis relance le workflow (bouton "Run workflow" ou
nouveau push vide : `git commit --allow-empty -m "chore: trigger first deploy"`).

---

## Fonctionnement au quotidien

A chaque push sur `main` :

1. GitHub Actions build les images avec le cache GHA (build rapide apres le premier)
2. Push sur GHCR avec deux tags : `latest` et le SHA du commit
3. Portainer met a jour la stack avec `IMAGE_TAG=<sha>` et `pullImage: true`
4. Les containers sont redemarres avec la nouvelle image

---

## Rollback

Pour revenir a un commit precedent, repere le SHA dans l'historique GitHub Actions
puis relance le workflow manuellement en modifiant `IMAGE_TAG` dans Portainer :

Portainer → Stacks → moyenax → Editor → modifier `IMAGE_TAG` → Update the stack

---

## Fichiers cles

| Fichier                          | Role                                              |
|----------------------------------|---------------------------------------------------|
| `.github/workflows/deploy.yml`   | Pipeline CI/CD complet (build + upsert stack)     |
| `docker-compose.portainer.yml`   | Stack de prod (Traefik + reseau proxy)            |
| `docker-compose.prod.yml`        | Ancienne config build local — gardee en backup    |
| `docker-compose.yml`             | Dev local uniquement                              |

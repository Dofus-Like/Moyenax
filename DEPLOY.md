# Guide de deploiement — GitHub Actions, GHCR et Portainer

Ce document decrit le nouveau flux CI/CD du repo :

- `feature/*` ou toute branche de travail part de `dev`
- PR vers `dev` : CI obligatoire, pas de deploiement
- merge sur `dev` : deploiement automatique sur la stack de test
- PR `dev -> main` : CI obligatoire
- merge sur `main` : deploiement automatique sur la stack de production

## Architecture cible

```
Pull request vers dev/main
    │
    ▼
GitHub Actions / CI
    ├── lint
    ├── tests
    └── smoke Docker prod-like

Push sur dev
    │
    ▼
Build images GHCR
    ├── tag SHA
    └── tag stable `dev`
    │
    ▼
Attente explicite des manifests GHCR
    │
    ▼
Deploy Portainer stack de test
    │
    ▼
Smoke HTTP sur /api/v1/health et sur le front

Push sur main
    │
    ▼
Build images GHCR
    ├── tag SHA
    └── tag stable `latest`
    │
    ▼
Attente explicite des manifests GHCR
    │
    ▼
Deploy Portainer stack de prod
    │
    ▼
Smoke HTTP sur /api/v1/health et sur le front
    │
    └── rollback automatique si le smoke test echoue
```

## Pourquoi le dernier deploy a casse

Le run en echec montrait :

- build GHCR termine avec succes
- update Portainer lancee quelques secondes apres
- erreur `manifest unknown` lors du `compose pull`

Le tag SHA existe bien dans GHCR ensuite. Le probleme etait donc tres probablement un
race condition entre la publication GHCR et le pull immediat par Portainer, pas un build
Docker invalide. Le nouveau workflow attend explicitement la disponibilite des manifests
avant d'appeler Portainer, puis retente l'update si Portainer retourne encore une erreur
transitoire de pull.

## Secrets et variables GitHub a configurer

### Secrets obligatoires

| Secret | Role |
|---|---|
| `PORTAINER_URL` | URL de l’API Portainer |
| `PORTAINER_API_TOKEN` | Token d’acces Portainer |
| `PORTAINER_ENDPOINT_ID` | Identifiant de l’environnement Portainer cible |
| `PORTAINER_STACK_NAME` | Nom exact de la stack de production, par exemple `dofus-like` |
| `JWT_SECRET` | Secret JWT partage par l’API |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL de la stack |

### Variables optionnelles

| Variable | Defaut | Role |
|---|---|---|
| `BASE_DOMAIN` | `roketlab.duckdns.org` | Domaine racine des URLs |
| `PORTAINER_TEST_STACK_NAME` | `${PORTAINER_STACK_NAME}-test` | Nom exact de la stack de test |
| `GHCR_NAMESPACE` | `roketag33` | Namespace GHCR |
| `GHCR_IMAGE_PREFIX` | `dofus-like` | Prefixe des images GHCR |

## Configuration Portainer / GHCR

Le workflow utilise le `GITHUB_TOKEN` natif de GitHub Actions pour pousser les
images sur GHCR, avec la permission `packages: write`.

Portainer doit pouvoir pull les images GHCR :

1. soit les packages GHCR sont publics
2. soit Portainer a un registry GHCR configure avec un token `read:packages`

Si tu restes sur le namespace actuel :

- API : `ghcr.io/roketag33/dofus-like-api`
- Web : `ghcr.io/roketag33/dofus-like-web`

Si tu renommes les images plus tard, il suffit de changer `GHCR_NAMESPACE` et
`GHCR_IMAGE_PREFIX` sans toucher au workflow.

## GitHub Environments recommandes

Cree deux environments GitHub :

1. `test`
2. `production`

Utilisation recommandee :

- `test` : deployment automatique depuis `dev`
- `production` : deployment depuis `main`, avec approbation manuelle optionnelle

Tu peux y surcharger `JWT_SECRET`, `POSTGRES_PASSWORD`, `PORTAINER_URL`,
`PORTAINER_API_TOKEN` et `PORTAINER_ENDPOINT_ID` si tu veux isoler davantage
le test de la prod.

## Branch protection recommandee

Le workflow seul ne suffit pas si quelqu’un pousse directement sur `main`.
Configure les branch rules GitHub :

1. `dev`
   - PR obligatoire
   - status checks obligatoires sur la CI
2. `main`
   - PR obligatoire
   - status checks obligatoires sur la CI
   - merge uniquement depuis `dev`
   - approbation requise avant merge

## URLs generees

Les URLs sont derivees du nom de stack :

- prod `dofus-like`
  - web: `https://dofus-like.roketlab.duckdns.org`
  - api: `https://dofus-like-api.roketlab.duckdns.org/api/v1/health`
- test `dofus-like-test`
  - web: `https://dofus-like-test.roketlab.duckdns.org`
  - api: `https://dofus-like-test-api.roketlab.duckdns.org/api/v1/health`

## Rollback

Le job de production sauvegarde avant update :

- le compose file courant de la stack Portainer
- les variables d’environnement courantes de la stack

Si le smoke test HTTP echoue apres deploiement, le workflow restaure automatiquement
l’etat precedent. Ce n’est pas du blue/green complet, donc le zero downtime absolu
n’est pas garanti avec une seule stack Compose, mais la fenetre d’indisponibilite est
fortement reduite et le rollback devient automatique.

## Fichiers cles

| Fichier | Role |
|---|---|
| `.github/workflows/_quality-gates.yml` | Reusable workflow CI |
| `.github/workflows/ci.yml` | CI sur PR et pushes `dev`/`main` |
| `.github/workflows/deploy.yml` | Build, attente GHCR, deploy Portainer, smoke, rollback |
| `scripts/ci/portainer-deploy.mjs` | Orchestration du deploy Portainer et rollback |
| `docker-compose.portainer.yml` | Definition de stack deployee sur Portainer |
| `apps/api/src/health/*` | Endpoint de sante pour smoke tests et supervision |

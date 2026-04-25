# Contribuer à Dofus-Like

Bienvenue 👋 — ce guide est la version **humaine** et narrative de notre charte. La version normative (lue par les humains **et** les IA) est dans [`AGENTS.md`](./AGENTS.md).

---

## 1. Première fois sur le repo ?

```bash
git clone <url> && cd Dofus-Like
yarn setup    # install + Docker + migrations + seed
yarn dev      # API + Web en parallèle
```

Comptes seedés : `warrior@test.com` / `mage@test.com` (mdp `password123`).

Détails : [`README.md`](./README.md).

---

## 2. Ce qu'il faut lire avant de coder

Dans cet ordre, et **avant** d'ouvrir le premier fichier :

1. [`AGENTS.md`](./AGENTS.md) — **la charte d'équipe**. Vraiment.
2. [`docs/PROJECT_LAYOUT.md`](./docs/PROJECT_LAYOUT.md) — **où ranger quoi** (« j'ajoute X, ça va où ? »).
3. [`docs/CODE_QUALITY.md`](./docs/CODE_QUALITY.md) — SOLID / DRY / KISS / YAGNI **avec des exemples du repo**.
4. [`docs/TESTING.md`](./docs/TESTING.md) — comment on fait du TDD ici.
5. [`TEAMS_SCOPE.md`](./TEAMS_SCOPE.md) — qui touche à quoi (Équipe A vs B).
6. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — la vue d'ensemble.

Ça représente ~30 minutes. C'est rentable au bout de la première PR.

---

## 3. Les 4 principes qui dirigent tout le code

- **SOLID** — surtout SRP : si tu ajoutes une 9ᵉ méthode publique à un service, tu le découpes.
- **DRY** — toute logique métier dupliquée front/back doit aller dans `libs/game-engine`.
- **KISS** — pas de pattern pour le pattern. ESLint te criera dessus si une fonction dépasse 50 lignes ou complexité 10.
- **YAGNI** — pas d'abstraction « au cas où ». Un seul cas d'usage = pas d'interface.

> Détails et **exemples concrets pris dans notre code** : [`docs/CODE_QUALITY.md`](./docs/CODE_QUALITY.md).

---

## 4. TDD — comment on travaille

Sur toute **logique métier** (calculs, règles, services NestJS) et tout **fix de bug** :

1. **Red** : tu écris le test qui échoue (et tu vérifies qu'il échoue pour la bonne raison).
2. **Green** : tu écris le code minimal qui le fait passer.
3. **Refactor** : tu nettoies, les tests doivent rester verts.

Pour le glue code (controller fin, composant React purement présentationnel), TDD est encouragé mais pas exigé.

> Détails (pyramide 70/20/10, seuils, outils par projet) : [`docs/TESTING.md`](./docs/TESTING.md).

---

## 5. Workflow Git

### Créer une branche
```bash
git checkout dev
git pull
git checkout -b feat/combat-line-of-sight    # ou fix/, chore/, refactor/, test/, docs/, perf/
```

### Commiter
On suit **Conventional Commits**. `commitlint` bloque les commits non conformes :

```
feat(combat): add line-of-sight check in spell resolver
fix(api): prevent stale Redis lock in matchmaking
test(spells): cover area-of-effect edge case
```

### Ouvrir une PR
- Cible : `dev` (jamais `main` directement — la CI bloque).
- Titre : même format Conventional Commits que les commits.
- Le template de PR (`.github/PULL_REQUEST_TEMPLATE.md`) se charge tout seul.
- Diff cible : < 400 lignes, sinon explique pourquoi dans la description.
- Au moins 1 review humaine + CI verte → squash merge.

### Périmètres
- **Équipe A** (World/Economy/Player) → modules `world/`, `economy/`, `player/` côté API.
- **Équipe B** (Combat) → module `combat/` côté API.
- **Co-propriété** : `libs/*`. Toute modif des contrats partagés doit être validée par les deux équipes.

> Détails : [`TEAMS_SCOPE.md`](./TEAMS_SCOPE.md). `CODEOWNERS` réclame automatiquement les bonnes reviews.

---

## 6. La review : ce qu'on regarde

Tu retrouveras la même checklist dans le template de PR :

- [ ] Tests couvrant la logique modifiée.
- [ ] Lint/format CI verte, pas de boundary NX violée.
- [ ] Pas d'`any`, pas de `console.log`, pas de TODO orphelin.
- [ ] Une fonction = un job. Si > 50 lignes, on découpe.
- [ ] Pas de duplication front/back (sinon → `libs/game-engine` ou `libs/shared-types`).
- [ ] Doc à jour si le contrat public change.

---

## 7. Pour les outils IA (Claude Code, Antigravity, Cursor…)

Si tu pair-codes avec une IA :

- L'IA doit avoir lu [`AGENTS.md`](./AGENTS.md) (`CLAUDE.md` et `GEMINI.md` y redirigent).
- L'IA respecte les mêmes règles que toi : TDD, Conventional Commits, pas de fichier `.md` spontané, pas d'abstraction spéculative.
- **Tu** restes responsable du code que tu mergres. Relis avant de pusher.
- Si l'IA propose une solution qui contredit la charte, c'est l'IA qui a tort. Renvoie-la lire `AGENTS.md`.

---

## 8. En cas de doute

- Demande dans Slack/Discord.
- Préfère une PR petite et imparfaite à une PR énorme et parfaite.
- Si la charte est mal calibrée → ouvre une PR `docs/charter-update` et on en discute.

Bon code 🛠️.

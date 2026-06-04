# AGENTS.md

Source unique de vérité pour humains et IA (Claude Code, Antigravity/Gemini, Cursor, Copilot…).
`CLAUDE.md` et `GEMINI.md` redirigent ici.

## Lectures obligatoires
1. Ce fichier.
2. [`docs/PROJECT_LAYOUT.md`](./docs/PROJECT_LAYOUT.md) — où ranger quoi.
3. [`docs/CODE_QUALITY.md`](./docs/CODE_QUALITY.md) — SOLID/DRY/KISS/YAGNI avec exemples.
4. [`docs/TESTING.md`](./docs/TESTING.md) — TDD, pyramide, seuils.
5. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — couches, boundaries NX, god nodes.
6. [`TEAMS_SCOPE.md`](./TEAMS_SCOPE.md) — Équipe A (World/Economy) vs B (Combat).
7. [`design.md`](./design.md) — design system UI : **seule** référence visuelle autorisée (tout travail d'interface).

Avant de modifier un service connu pour être chargé : ouvrir `graphify-out/GRAPH_REPORT.md`.

## Stack (rappel)
NX 22 · Node 22 · Yarn · NestJS 11 · React 19 + Vite + R3F · Prisma 5 / Postgres 16 · Redis 7 · SSE · Jest (api) · Vitest (web) · Playwright · ESLint 9 + Biome 2.

## Commandes
`yarn dev` · `yarn test` · `yarn lint` · `yarn format` · `nx affected -t test` · `nx graph`.
Liste complète : [`README.md`](./README.md).

## Règles non-négociables

### Architecture
- Boundaries NX appliquées par ESLint (`@nx/enforce-module-boundaries`).
- **Logique métier pure → `libs/game-engine`**, jamais dans un service ou un composant.
- **Types/DTOs partagés front/back → `libs/shared-types`**, jamais dupliqués.
- **Combat ↔ Economy** : couplage lâche via `GAME_EVENTS` + `EventEmitter2`, jamais d'import direct.
- DTOs `class-validator` obligatoires sur toute entrée HTTP.
- God nodes (cf. `GRAPH_REPORT.md`) : aucun ajout sans plan de découpe.

### Code
- TS `strict`, **pas de `any`** (`unknown` + narrowing si besoin), **pas de cycle d'import**.
- ESLint enforcés : `complexity ≤ 10`, `max-lines-per-function ≤ 50`, `max-depth ≤ 4`, `max-params ≤ 4`, pas de ternaire imbriqué.
- Pas de `console.log` (utiliser `Logger` côté NestJS, HUD perf côté web).
- Commentaires : par défaut **aucun**. Seulement pour le « pourquoi » non évident. Renomme avant de commenter.
- Préférer **éditer** un fichier existant que d'en créer un nouveau.

### UI / Design
- Tout travail d'interface applique **exclusivement** le design system de [`design.md`](./design.md) (tokens, surface « glass », composants, patterns). C'est la **seule** référence visuelle.
- ❌ Aucune autre convention visuelle, thème, couleur en dur hors token, ni librairie de composants UI.
- Réutiliser les tokens/patterns existants ; ne pas réinventer couleurs, espacements ou composants déjà définis.

### Assets (modèles, sprites, skins) — auto-découverte
Les assets web sont **auto-découverts** par registre via `import.meta.glob` : **déposer le fichier au bon endroit suffit**, aucun import manuel, aucune liste à éditer. Vivent dans `apps/web/src/assets/` (jamais `public/` : Vite les hashe, inline les <4 Ko et exclut le build de ce qui est inutile).

- **Modèles GLB** → `apps/web/src/assets/models/<categorie>/<nom>.glb` (`environments/`, `poi/`, `props/`). Référencer **toujours** via `modelUrl('<categorie>/<nom>.glb')` (`game/models/modelRegistry.ts`), **jamais** un chemin `/assets/...` en dur. `raw/` = sources lourdes, exclues du build de prod (`loadRawModels()`, DEV-only).
- **Sprites** → `apps/web/src/assets/sprites/<perso>/{idle,walk,attack}.png` (`idle.png` obligatoire = le perso est listé). Référencer via `spriteUrl('<perso>', 'idle'|'walk'|'attack')` / `allSpriteUrls()` (`game/constants/spriteRegistry.ts`), **jamais** une URL en dur (ni en JS, ni en `background-image` CSS — utiliser un fond inline).
- **Skins** → `apps/web/src/assets/skins/<id>.json` (`{ id, name, type, hue, saturation, description, sortOrder? }` ; `type` = nom du dossier de sprites). Lus via `SKINS` / `getSkinById('<id>')` (`game/constants/skins.ts`).

**Ajouter un perso** = déposer `sprites/<nom>/{idle,walk,attack}.png` **+** `skins/<id>.json` (`"type": "<nom>"`) → il apparaît partout, zéro code.
- ❌ Ne jamais mettre un asset dans `public/` ni écrire un chemin `/assets/...` en dur — toujours passer par le registre.
- ❌ Ne pas maintenir de liste/tableau d'assets à la main — le glob s'en charge.
- En **déplaçant/renommant** un asset : vérifier qu'aucun chemin en dur ne subsiste (`grep -rn '/assets/' apps/web/src`) ; tout doit passer par une clé de registre.

### Tests (TDD)
- **Obligatoire** : tout fix de bug (test rouge → fix), toute logique dans `libs/game-engine`, tout code sécurité.
- Cycle **Red → Green → Refactor**, vérifier que le test échoue **pour la bonne raison**.
- `*.spec.ts(x)` colocalisé.
- Pyramide : 70 % unit / 20 % integration / 10 % e2e Playwright.
- Pas de mock de la fonction testée. Pas de test flaky « skipé ».

### Git
- Branches : `<type>/<desc-kebab>` cible `dev` (jamais `main`). Types : `feat|fix|chore|refactor|test|docs|perf`.
- Commits : Conventional Commits, **enforcés par commitlint** au commit-msg.
- PR < 400 lignes diff (sinon justifier). Template auto. CODEOWNERS approuve par périmètre. Squash merge.

## Pour les IA (toutes confondues)

### À faire
- Lire les docs ci-dessus avant d'écrire.
- TDD sur logique métier et fixes.
- Petits commits atomiques en Conventional Commits.
- Demander quand on doute, ne pas inventer un pattern.

### À ne pas faire
- ❌ Créer des `*.md` de session/notes/résumé spontanés.
- ❌ Commentaires qui paraphrasent le code.
- ❌ Abstractions spéculatives (interface à 1 impl jamais mockée, paramètre « au cas où »).
- ❌ `any`, `as` de complaisance.
- ❌ Duplication front/back (logique → `game-engine`, types → `shared-types`).
- ❌ Fix superficiel qui contourne la cause racine.
- ❌ `--no-verify` sur les hooks.
- ❌ Ajouter une méthode à un god node.
- ❌ Introduire un style, thème, couleur ou librairie de composants UI hors [`design.md`](./design.md).

### Mantras
- *Le test guide le code, pas l'inverse.*
- *3 lignes répétées valent mieux qu'une mauvaise abstraction.*
- *YAGNI bat OCP.*

## Liens
[`design.md`](./design.md) · [`README.md`](./README.md) · [`CONTRIBUTING.md`](./CONTRIBUTING.md) · [`TEAMS_SCOPE.md`](./TEAMS_SCOPE.md) · [`DEPLOY.md`](./DEPLOY.md) · `docs/{PROJECT_LAYOUT,ARCHITECTURE,TESTING,CODE_QUALITY,TECHNICAL_DOCUMENT}.md` · `graphify-out/GRAPH_REPORT.md`

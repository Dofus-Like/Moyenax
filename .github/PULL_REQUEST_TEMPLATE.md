<!--
Titre PR : Conventional Commits — ex: feat(combat): add line-of-sight check
Cible : `dev` (jamais `main` directement, la CI bloque)
-->

## 🎯 Pourquoi

<!-- Le contexte / le besoin / le bug. Pas le « quoi », le « pourquoi ». -->

## 🔧 Quoi

<!-- Liste courte des changements clés (3-5 puces max). -->

-
-

## ✅ Checklist (à cocher avant de demander review)

### Tests
- [ ] La logique modifiée est couverte par un test (TDD pour bug fix et logique métier).
- [ ] `yarn test` passe localement.
- [ ] Pour un bug fix : un test reproduit le bug avant le fix (Red → Green).

### Qualité
- [ ] `yarn lint` passe (pas de violation de boundaries NX).
- [ ] `yarn format:check` passe.
- [ ] Pas d'`any`, pas de `console.log` orphelin, pas de TODO sans ticket.
- [ ] Aucune fonction > 50 lignes ; complexité raisonnable.
- [ ] Pas de duplication front/back (logique → `libs/game-engine`, types → `libs/shared-types`).
- [ ] Si god node touché (cf. `graphify-out/GRAPH_REPORT.md`) : justification ou plan de découpe.

### Architecture
- [ ] Périmètre d'équipe respecté (`TEAMS_SCOPE.md`).
- [ ] Couplage Combat ↔ Economy via événements `GAME_EVENTS`, pas d'import direct.
- [ ] DTO validés (`class-validator`) sur toute entrée HTTP.

### Doc
- [ ] Si le contrat public change : `docs/ARCHITECTURE.md` ou `README.md` mis à jour.
- [ ] Si nouvelle convention/règle : `AGENTS.md` mis à jour.

## 🧪 Comment tester

<!-- Étapes manuelles si besoin. Sinon « yarn test » suffit. -->

## 📸 Captures / vidéos (si UI)

<!-- Glisser-déposer si change visuel. -->

## 🔗 Liens

<!-- Issue, ticket, doc, perf report… -->

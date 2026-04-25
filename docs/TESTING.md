# Stratégie de tests — Dofus-Like

> Cette page complète la charte [`AGENTS.md`](../AGENTS.md) §5.

---

## 1. Philosophie : TDD pragmatique

On vise le **TDD strict** sur ce qui compte, et le **test-first souple** sur le reste. La règle simple :

| Type de code | TDD obligatoire ? |
|---|---|
| Bug fix | ✅ **Oui** — test rouge qui reproduit, puis fix |
| Logique métier dans `libs/game-engine` | ✅ **Oui** — pure, isolée, doit être bétonnée |
| Code lié à la sécurité (auth, guards, rate-limit) | ✅ **Oui** |
| Service NestJS (orchestration) | 🟡 **Test-first encouragé**, exigé sur cas limites |
| Controller fin (juste DTO + délégation service) | 🟡 Couverture par integration suffit |
| Composant React purement présentationnel | 🟢 Optionnel |
| Scène R3F / 3D | 🟢 Pas de unit ; couvrir via e2e ou snapshot |

---

## 2. Cycle Red → Green → Refactor

1. **Red** — écrire le test, le **lancer**, vérifier qu'il échoue **pour la bonne raison**.
2. **Green** — code minimal pour passer (pas plus, on n'anticipe pas).
3. **Refactor** — nettoyer (extraire, renommer, dédupliquer) avec les tests comme filet.

> Avant de commiter, le test doit avoir vu **les deux états** (rouge puis vert). Si tu n'as vu que le vert, tu ne sais pas si le test détecte vraiment quelque chose.

---

## 3. Pyramide cible

```
          ┌────────────┐
          │    e2e     │  10 %  — Playwright
          ├────────────┤
          │integration │  20 %  — NestJS Test module + testcontainers
          ├────────────┤
          │   unit     │  70 %  — Jest / Vitest, mocks
          └────────────┘
```

### Unit (70 %)
- **`libs/game-engine`** : cœur du domaine, doit être 100 % unit, sans dépendance externe. Pure functions.
- **Services NestJS** : mocks Prisma/Redis (`jest.fn()`/`vi.fn()` ou bibliothèque légère).
- **Stores Zustand** et **utils** front : Vitest, sans rendu.
- **Composants présentationnels** : Testing Library — focus sur les comportements visibles, pas l'implémentation.

### Integration (20 %)
- **NestJS** : `Test.createTestingModule` avec **testcontainers** Postgres/Redis (à mettre en place — déjà dans la roadmap).
- Validation des contrats DTO + Prisma + flux SSE de bout en bout côté API.
- Aucune mock à ce niveau (sauf services externes payants).

### E2E (10 %)
- **Playwright** (déjà installé via `@nx/playwright`).
- **Critical paths uniquement** : `login → lobby → matchmaking → combat → fin de combat`.
- Run au push sur `dev` et `main`. Suite full nightly.

---

## 4. Outils par projet

| Projet | Runner | Config |
|---|---|---|
| `apps/api` | **Jest** | `apps/api/jest.config.cts` |
| `apps/web` | **Vitest** | `apps/web/vitest.config.*` |
| `libs/game-engine` | Jest (par défaut NX) | généré |
| `libs/shared-types` | Jest (si tests) | généré |
| `libs/ui-components` | Vitest | généré |
| E2E | **Playwright** | `apps/<app>-e2e/` (à créer pour le web) |

### Conventions de fichier

- `*.spec.ts` — colocalisé avec le fichier testé.
- `*.spec.tsx` — pour les composants React.
- `*.e2e.spec.ts` — Playwright (séparé).
- `__fixtures__/` — données de test partagées (à créer si besoin).

---

## 5. Anatomie d'un bon test

### Nom = comportement attendu
```ts
// ❌
it('test damage', () => {});

// ✅
it('returns 0 damage when target has 100% physical resistance', () => {});
```

### Structure AAA
```ts
it('does X when Y', () => {
  // Arrange
  const caster = createPlayer({ intelligence: 50 });
  const spell = createSpell({ power: 20 });

  // Act
  const result = calculateSpellDamage({ caster, spell });

  // Assert
  expect(result).toBe(95);
});
```

### Une assertion logique par test
Plusieurs `expect()` OK s'ils décrivent **un seul comportement**. Si tu testes 3 comportements → 3 tests.

### Pas de logique conditionnelle dans un test
Pas de `if`, pas de `for`. Si besoin, c'est probablement plusieurs tests à séparer (ou un `it.each`).

---

## 6. Mocks — règles

- **Mock le strict minimum**. Préférer un fake léger qu'un mock magique.
- **Aucun mock dans `libs/game-engine`** — la lib est pure par construction.
- **Pas de mock du module testé** (`jest.mock('./this-very-file')` est suspect).
- **Préférer testcontainers** à un mock pour Postgres/Redis dès qu'on touche à de la concurrence ou des transactions.

---

## 7. Couverture

### Cibles

| Périmètre | Cible long terme |
|---|---|
| `libs/game-engine` | **90 %+** (lignes + branches) |
| `apps/api` services | **80 %** |
| `apps/api` overall | **70 %** |
| `apps/web` (Vitest) | **60 %** (les scènes R3F sont exclues) |

### Mode actuel : **baseline-only**
On **mesure** la couverture réelle d'abord, on stocke la baseline, puis on bloque sur `current − 2 %`. Pas de fail CI tant que la baseline n'est pas posée. Cible : poser la baseline dans une PR `chore/test-coverage-baseline` avec :
- Génération du rapport (`--coverage`).
- Stockage des chiffres dans un JSON versionné.
- Job CI qui compare la PR à la baseline.

### Ce qui **ne compte pas** dans la couverture
- Code généré (`prisma/generated/`).
- DTOs `class-validator` (couverts par integration).
- Bootstrap (`main.ts`, `module` decorators).
- Scènes Three.js / R3F (couvertes par e2e).

---

## 8. Tester du NestJS — patterns

### Service avec Prisma mocké
```ts
import { Test } from '@nestjs/testing';

const prisma = { player: { findUnique: jest.fn() } };

beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      PlayerService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  service = module.get(PlayerService);
});
```

### Controller (integration légère)
```ts
const app = await Test.createTestingModule({
  imports: [PlayerModule],
})
  .overrideProvider(PrismaService).useValue(prisma)
  .compile();

return request(app.getHttpServer()).get('/players/me').expect(200);
```

### Service avec Redis (préférer testcontainers à un fake)
À mettre en place dans un PR `chore/test-redis-testcontainers`.

---

## 9. Tester du React — patterns

### Composant
```tsx
import { render, screen } from '@testing-library/react';

it('shows the player name', () => {
  render(<PlayerCard name="Iop" />);
  expect(screen.getByText('Iop')).toBeInTheDocument();
});
```

### Store Zustand
```ts
import { useCombatStore } from './combat.store';

beforeEach(() => useCombatStore.setState(useCombatStore.getInitialState()));

it('updates current PA on action', () => {
  useCombatStore.getState().consumePa(2);
  expect(useCombatStore.getState().currentPa).toBe(4);
});
```

### Page avec React Query
Wrapper avec `QueryClientProvider` à `staleTime: Infinity`, mock le client axios via MSW si besoin.

---

## 10. Anti-patterns à proscrire

- ❌ Test qui ne **fait rien échouer** quand on supprime le code testé.
- ❌ Assertion `expect(x).toBeTruthy()` quand on attend une valeur précise.
- ❌ Mocker la fonction qu'on est en train de tester.
- ❌ Snapshot massif d'un composant entier (préférer asserts ciblées).
- ❌ Test qui dépend de l'ordre d'exécution.
- ❌ Test qui dépend de `Date.now()` non figé.
- ❌ Test qui passe par hasard (flaky) — on le **fix** ou on le **supprime**, on ne le `skip` pas.

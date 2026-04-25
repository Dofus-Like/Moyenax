# Charte qualité — SOLID / DRY / KISS / YAGNI

> Cette page complète [`AGENTS.md`](../AGENTS.md) §4 avec **des exemples pris dans notre code**.

---

## 1. SOLID

### 1.1 SRP — Single Responsibility Principle

> *« Une classe doit avoir une, et une seule, raison de changer. »*

**Diagnostic actuel** (cf. [`graphify-out/GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md)) — nos god nodes :

| Service | Edges | Probable violation |
|---|---|---|
| `RedisService` | 20 | Connait tous les domaines (combat, matchmaking, perf, sse…) |
| `GameSessionService` | 18 | Lifecycle + Matchmaking + Persistence + Permissions |
| `SessionService` | 16 | Read + Write + Lock dans la même classe |
| `SpellsService` | 11 | Catalog + Resolver + Validator |

**Règle pratique** : si un service dépasse **300 lignes** ou **8 méthodes publiques**, on le découpe avant d'ajouter quoi que ce soit.

**Comment découper `RedisService`** (exemple) :
```ts
// ❌ Avant
class RedisService {
  setCombatState(...) {}
  getCombatState(...) {}
  pushMatchmakingPlayer(...) {}
  popMatchmakingPlayer(...) {}
  recordPerf(...) {}
  publishSse(...) {}
  ...
}

// ✅ Après — un repository par bounded context
class CombatStateRepository { setState(); getState(); }
class MatchmakingQueueRepository { push(); pop(); }
class PerfMetricsRepository { record(); }
class SseChannelRepository { publish(); }
// + RedisClient bas niveau (factory ioredis), injecté dans chacun
```

### 1.2 OCP — Open / Closed

> Ouvert à l'extension, fermé à la modification.

Dans NestJS, ça veut dire **composer plutôt que modifier** :
- Nouveau type de sort → nouvelle stratégie injectée dans `SpellResolverService`, pas un `switch` qui grossit.
- Nouvelle source de récompense → nouvel handler d'événement `COMBAT_ENDED`, pas un `if` dans `EconomyListenerService`.

### 1.3 LSP — Liskov Substitution

> Une sous-classe doit pouvoir remplacer sa parente sans casser le contrat.

Pratique : si une stratégie/sous-classe doit lancer une exception dans une méthode héritée, l'abstraction est mauvaise. Préférer composition.

### 1.4 ISP — Interface Segregation

> Plusieurs petites interfaces valent mieux qu'une grosse.

Concrètement chez nous : ne **pas** créer un méga `IGameSessionService` listant toutes les méthodes. Si un consommateur n'a besoin que de lire le score, il dépend d'un port `ScoreReader`, pas du service entier.

### 1.5 DIP — Dependency Inversion

> Dépendre d'abstractions, pas de classes concrètes.

NestJS DI nous le donne **gratuitement** :
```ts
// ✅
constructor(private readonly stateRepo: CombatStateRepository) {}

// ❌
const stateRepo = new CombatStateRepository(new Redis());
```

Mais attention au piège : **ne pas créer une interface si tu n'as qu'une implémentation et que tu ne la mockes jamais.** YAGNI > DIP en pratique.

---

## 2. DRY — Don't Repeat Yourself

### Bien
- Toute **logique métier** front + back → `libs/game-engine`. Ex : `calculateDamage`, `isWalkable`, `findPath`.
- Tout **type partagé** front + back → `libs/shared-types`. Ex : `CombatState`, `SpellDefinition`, `GAME_EVENTS`.
- Les **tests partagés** (factories d'objets de combat) dans un `__fixtures__/` du projet ou dans un dossier de la lib.

### Faux DRY (à éviter)
- 3 lignes de code similaires ≠ duplication. **Une mauvaise abstraction coûte plus cher qu'une duplication assumée.**
- Extraire un helper de 1 ligne juste pour un nom : laisse l'inline.
- Méta-générer du code parce que « ça se répète » alors que ça ne se répète **pas vraiment** (les variations cachent des différences).

### Détection
- Vu deux fois → on note.
- Vu trois fois et **sur le même axe de variation** → on extrait.

---

## 3. KISS — Keep It Simple, Stupid

### Règles automatiques (ESLint)

| Règle | Limite |
|---|---|
| `complexity` | ≤ 10 |
| `max-lines-per-function` | ≤ 50 |
| `max-depth` | ≤ 4 |
| `max-params` | ≤ 4 (au-delà → object param) |
| `no-nested-ternary` | error |

### Heuristiques humaines
- Si tu écris un commentaire pour expliquer **comment** ça marche → renomme/extrais.
- Si tu hésites entre deux conceptions → choisis celle qui se lit en moins de **30 secondes**.
- Si une PR demande 10 minutes de review pour comprendre → c'est trop complexe.

### Spécifique à notre code
- Préférer **une fonction pure dans `game-engine`** à un service NestJS injecté pour un calcul stateless.
- Préférer **`useState` + props** à un nouveau store Zustand pour un état purement local.
- Préférer **SSE** (déjà en place) à WebSocket si on n'a pas besoin de bidi.

---

## 4. YAGNI — You Aren't Gonna Need It

> Ne pas écrire ce qui pourrait servir un jour. Écrire ce qui sert maintenant.

### Symptômes à proscrire
- ❌ `interface Foo` pour une seule classe `FooImpl` jamais mockée. Supprimer l'interface.
- ❌ Paramètre optionnel **sans cas d'usage actuel**. Supprimer le paramètre.
- ❌ Feature flag « pour quand on aura besoin ».
- ❌ Méthode publique exportée non appelée. Supprimer.
- ❌ Champ DTO « au cas où le front en aurait besoin ». Supprimer, on ajoutera quand le front le demandera.
- ❌ Couches d'abstraction « pour préparer la migration vers X ». Migrer X quand X arrive.

### Quand abstraire ?
**À la 3ᵉ utilisation réelle**, pas avant. La 1ʳᵉ on inline, la 2ᵉ on duplique en notant la dette, la 3ᵉ on factorise — et là on connaît les **bons axes** de variation.

---

## 5. Cas concrets pris dans le repo

### 5.1 Calcul de dégâts
✅ `libs/game-engine/src/combat/calculateDamage()` → pure, testable, importée des deux côtés.
❌ Si tu vois un calcul de damage dans un controller ou un composant React, c'est une régression DRY/SRP — à remonter dans `game-engine`.

### 5.2 Communication Combat ↔ Economy
✅ Couplage via `GAME_EVENTS` + `EventEmitter2` (déjà en place).
❌ Importer directement `EconomyService` depuis le module `combat` casserait à la fois SRP et le boundary NX. Le lint te bloquerait.

### 5.3 Matchmaking queue
🟡 `MatchmakingQueueStore` (15 edges) sait **lire**, **écrire**, et **valider**. Découpe future :
```
MatchmakingQueueReader      ← projection / read model
MatchmakingQueueWriter      ← commande
MatchmakingValidator        ← règles métier (game-engine)
```

### 5.4 Stats effectives
✅ `PlayerStatsService` (Équipe A) **délègue** à `game-engine` (`calculateEffectiveStats`).
❌ Recalculer côté Combat = duplication. Le contrat est : on lit toujours via `PlayerStatsService`.

---

## 6. Antipatterns spécifiques que nous avons identifiés

- **`any` toléré** dans les anciennes parties → `eslint --max-warnings=0` + `no-explicit-any: error` les fait remonter au prochain touch.
- **`console.log` orphelins** → bloqués par `no-console: warn` (sauf `warn`/`error`). Préférer `Logger` (NestJS) ou le HUD perf (`apps/web/src/perf/`).
- **Tests qui mockent tout** → revoir, le test ne sert plus à rien.
- **Composants 500+ lignes** → découper en sous-composants. Limite ESLint : 50 lignes/fonction (composant fonctionnel inclus).

---

## 7. Mantras à graver

- *« Le code est lu 10 fois plus qu'il n'est écrit. »*
- *« 3 lignes répétées valent mieux qu'une mauvaise abstraction. »*
- *« YAGNI bat OCP : code pour aujourd'hui, pas pour 2027. »*
- *« Si un test mock tout, il ne teste rien. »*
- *« Renomme avant de commenter. »*

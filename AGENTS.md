# Agent Instructions

## Knowledge Graph (graphify)

This project has a graphify knowledge graph at `graphify-out/`.

### Before doing anything architecture-related

1. Read `graphify-out/wiki/index.md` — it lists all communities and god nodes
2. Navigate the relevant community article(s) in `graphify-out/wiki/`
3. For god nodes and surprising cross-cutting connections, read `graphify-out/GRAPH_REPORT.md`

Do **not** grep raw source files to understand architecture — the graph already has that structure mapped.

### After modifying code files

Run this to keep the graph current (AST-only, free, no LLM):

```bash
python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

### God nodes (highest-connectivity abstractions — touch carefully)

- `RedisService` — 20 edges
- `PerfStatsService` — 19 edges
- `GameSessionService` — 18 edges
- `SessionService` — 16 edges
- `GameSessionController` — 16 edges
- `NestJS Event Emitter Inter-Team Communication` — 16 edges
- `MatchmakingQueueStore` — 15 edges

### Key communities

| Community | Nodes | What it is |
|---|---|---|
| NestJS App Infrastructure | 46 | App module, all NestJS wiring |
| Combat Game Design | 38 | Game design docs, rules, archetypes |
| Game Session Management | 18 | Session lifecycle, VS AI, cleanup |
| Combat Turn Engine | 10 | Turn logic, spell casting, victory check |
| Spell Effects Engine | 12 | Damage, heal, buff application |
| Redis Cache Layer | 21 | All Redis read/write operations |
| Matchmaking Queue | 16 | Queue store, security, SSE tickets |
| Performance Monitoring | 23 | PerfStats, tracing, HTTP interceptor |
| Pathfinding Library | 6 | `findPath`, `canJumpOver`, shared-types |
| Crafting System | 8 | Recipe resolution, gold spend |
| Map Generation | 12 | Procedural map, connectivity |
| CI/CD Pipeline | 10 | GitHub Actions, GHCR, Portainer |

### Re-running graphify

To update the full graph after major changes (new files, renamed modules):

```bash
# Incremental — only changed files
/graphify . --update

# Full rebuild
/graphify .
```

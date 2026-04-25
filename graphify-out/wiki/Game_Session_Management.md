# Game Session Management

> 18 nodes · cohesion 0.16

## Key Concepts

- **GameSessionService** (18 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.createVsAiSession()** (3 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.forceReset()** (3 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.endSession()** (3 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.cleanupSessionArtifacts()** (3 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.cleanupStandaloneCombatSessions()** (3 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.createSession()** (2 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.getCurrentSession()** (2 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.getActiveSession()** (2 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.setReady()** (2 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.startMatch()** (2 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.handleCombatEnded()** (2 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.constructor()** (1 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.getWaitingSessions()** (1 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.joinPrivateSession()** (1 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.getSessionInventory()** (1 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.issueStreamTicket()** (1 connections) — `apps\api\src\game-session\game-session.service.ts`
- **.recomputePersistentLoadout()** (1 connections) — `apps\api\src\game-session\game-session.service.ts`

## Relationships

- [[NestJS App Infrastructure]] (1 shared connections)

## Source Files

- `apps\api\src\game-session\game-session.service.ts`

## Audit Trail

- EXTRACTED: 51 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*
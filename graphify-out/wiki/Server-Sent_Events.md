# Server-Sent Events

> 9 nodes · cohesion 0.36

## Key Concepts

- **SseService** (8 connections) — `apps\api\src\shared\sse\sse.service.ts`
- **.getActiveSubscriberCount()** (4 connections) — `apps\api\src\shared\sse\sse.service.ts`
- **.removeStream()** (3 connections) — `apps\api\src\shared\sse\sse.service.ts`
- **.getOrCreateStream()** (3 connections) — `apps\api\src\shared\sse\sse.service.ts`
- **.releaseSubscriber()** (3 connections) — `apps\api\src\shared\sse\sse.service.ts`
- **.emit()** (2 connections) — `apps\api\src\shared\sse\sse.service.ts`
- **sse.service.ts** (1 connections) — `apps\api\src\shared\sse\sse.service.ts`
- **.constructor()** (1 connections) — `apps\api\src\shared\sse\sse.service.ts`
- **.getStream()** (1 connections) — `apps\api\src\shared\sse\sse.service.ts`

## Relationships

- No strong cross-community connections detected

## Source Files

- `apps\api\src\shared\sse\sse.service.ts`

## Audit Trail

- EXTRACTED: 26 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*
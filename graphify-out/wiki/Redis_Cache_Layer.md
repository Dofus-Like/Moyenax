# Redis Cache Layer

> 21 nodes · cohesion 0.19

## Key Concepts

- **RedisService** (20 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.measure()** (15 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.get()** (4 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.setJson()** (4 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.set()** (3 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.getKeyPrefix()** (3 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.constructor()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.del()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.type()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.rename()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.setIfNotExists()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.getJson()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.zAdd()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.zAddMany()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.zRange()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.zRem()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.zScore()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.zCard()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.ping()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **.getKeySuffix()** (2 connections) — `apps\api\src\shared\redis\redis.service.ts`
- **redis.service.ts** (1 connections) — `apps\api\src\shared\redis\redis.service.ts`

## Relationships

- No strong cross-community connections detected

## Source Files

- `apps\api\src\shared\redis\redis.service.ts`

## Audit Trail

- EXTRACTED: 78 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*
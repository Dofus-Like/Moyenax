# Performance Logging

> 11 nodes · cohesion 0.35

## Key Concepts

- **PerfLoggerService** (10 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.shouldLog()** (6 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.logDuration()** (4 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.writeRecord()** (4 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.logEvent()** (3 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.logMetric()** (3 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.isEnabled()** (2 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.getSlowThresholdMs()** (2 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.getSampleRate()** (2 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **perf-logger.service.ts** (1 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`
- **.constructor()** (1 connections) — `apps\api\src\shared\perf\perf-logger.service.ts`

## Relationships

- No strong cross-community connections detected

## Source Files

- `apps\api\src\shared\perf\perf-logger.service.ts`

## Audit Trail

- EXTRACTED: 38 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*
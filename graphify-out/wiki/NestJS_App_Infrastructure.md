# NestJS App Infrastructure

> 46 nodes · cohesion 0.05

## Key Concepts

- **NestJS Event Emitter Inter-Team Communication** (16 connections) — `TECHNICAL_DOCUMENT.md`
- **FarmingService** (9 connections) — `apps\api\src\world\farming\farming.service.ts`
- **EquipmentService** (7 connections) — `apps\api\src\economy\equipment\equipment.service.ts`
- **InventoryService** (6 connections) — `apps\api\src\economy\inventory\inventory.service.ts`
- **.withSpendableGold()** (6 connections) — `apps\api\src\world\farming\farming.service.ts`
- **BotService** (4 connections) — `apps\api\src\combat\bot\bot.service.ts`
- **EconomyListenerService** (4 connections) — `apps\api\src\economy\economy-listener.service.ts`
- **.updatePlayerStatsAndSpells()** (4 connections) — `apps\api\src\economy\equipment\equipment.service.ts`
- **.equip()** (3 connections) — `apps\api\src\economy\equipment\equipment.service.ts`
- **app.module.ts** (2 connections) — `apps\api\src\app\app.module.ts`
- **AppModule** (2 connections) — `apps\api\src\app\app.module.ts`
- **bot.service.ts** (2 connections) — `apps\api\src\combat\bot\bot.service.ts`
- **.handleTurnStarted()** (2 connections) — `apps\api\src\combat\bot\bot.service.ts`
- **.makeMove()** (2 connections) — `apps\api\src\combat\bot\bot.service.ts`
- **turn.module.ts** (2 connections) — `apps\api\src\combat\turn\turn.module.ts`
- **turn.service.ts** (2 connections) — `apps\api\src\combat\turn\turn.service.ts`
- **economy-listener.service.ts** (2 connections) — `apps\api\src\economy\economy-listener.service.ts`
- **equipment.service.ts** (2 connections) — `apps\api\src\economy\equipment\equipment.service.ts`
- **.getEquipment()** (2 connections) — `apps\api\src\economy\equipment\equipment.service.ts`
- **.unequip()** (2 connections) — `apps\api\src\economy\equipment\equipment.service.ts`
- **.validateSlotCompatibility()** (2 connections) — `apps\api\src\economy\equipment\equipment.service.ts`
- **inventory.service.ts** (2 connections) — `apps\api\src\economy\inventory\inventory.service.ts`
- **game-session.service.ts** (2 connections) — `apps\api\src\game-session\game-session.service.ts`
- **farming.service.ts** (2 connections) — `apps\api\src\world\farming\farming.service.ts`
- **.getOrCreateInstance()** (2 connections) — `apps\api\src\world\farming\farming.service.ts`
- *... and 21 more nodes in this community*

## Relationships

- [[Combat Game Design]] (2 shared connections)
- [[Combat Turn Engine]] (1 shared connections)
- [[Game Session Management]] (1 shared connections)
- [[Combat Session Service]] (1 shared connections)
- [[Project Tech Stack]] (1 shared connections)

## Source Files

- `TECHNICAL_DOCUMENT.md`
- `apps\api\src\app\app.module.ts`
- `apps\api\src\combat\bot\bot.service.ts`
- `apps\api\src\combat\session\session.service.spec.ts`
- `apps\api\src\combat\turn\turn.module.ts`
- `apps\api\src\combat\turn\turn.service.spec.ts`
- `apps\api\src\combat\turn\turn.service.ts`
- `apps\api\src\economy\economy-listener.service.ts`
- `apps\api\src\economy\equipment\equipment.service.ts`
- `apps\api\src\economy\inventory\inventory.service.ts`
- `apps\api\src\game-session\game-session.service.ts`
- `apps\api\src\world\farming\farming.service.ts`

## Audit Trail

- EXTRACTED: 116 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*
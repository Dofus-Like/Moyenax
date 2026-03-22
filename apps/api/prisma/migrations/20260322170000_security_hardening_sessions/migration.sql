CREATE UNIQUE INDEX IF NOT EXISTS "GameSession_player1Id_open_key"
ON "GameSession"("player1Id")
WHERE "status" IN ('WAITING', 'ACTIVE');

CREATE UNIQUE INDEX IF NOT EXISTS "GameSession_player2Id_open_key"
ON "GameSession"("player2Id")
WHERE "status" IN ('WAITING', 'ACTIVE') AND "player2Id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CombatSession_player1Id_open_public_key"
ON "CombatSession"("player1Id")
WHERE "status" IN ('WAITING', 'ACTIVE') AND "gameSessionId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CombatSession_player2Id_open_public_key"
ON "CombatSession"("player2Id")
WHERE "status" IN ('WAITING', 'ACTIVE') AND "gameSessionId" IS NULL AND "player2Id" IS NOT NULL;

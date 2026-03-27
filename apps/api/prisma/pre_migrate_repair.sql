-- Close duplicate open sessions before applying unique partial indexes.
-- We keep the most recently created open session per player/role and finish the older ones.

WITH ranked_game_sessions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "player1Id"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "GameSession"
  WHERE status IN ('WAITING', 'ACTIVE')
)
UPDATE "GameSession" AS session
SET
  status = 'FINISHED',
  "endedAt" = COALESCE(session."endedAt", NOW())
FROM ranked_game_sessions AS ranked
WHERE session.id = ranked.id
  AND ranked.rn > 1;

WITH ranked_joined_game_sessions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "player2Id"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "GameSession"
  WHERE status IN ('WAITING', 'ACTIVE')
    AND "player2Id" IS NOT NULL
)
UPDATE "GameSession" AS session
SET
  status = 'FINISHED',
  "endedAt" = COALESCE(session."endedAt", NOW())
FROM ranked_joined_game_sessions AS ranked
WHERE session.id = ranked.id
  AND ranked.rn > 1;

WITH ranked_public_combats AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "player1Id"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "CombatSession"
  WHERE status IN ('WAITING', 'ACTIVE')
    AND "gameSessionId" IS NULL
)
UPDATE "CombatSession" AS session
SET
  status = 'FINISHED',
  "endedAt" = COALESCE(session."endedAt", NOW())
FROM ranked_public_combats AS ranked
WHERE session.id = ranked.id
  AND ranked.rn > 1;

WITH ranked_joined_public_combats AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "player2Id"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "CombatSession"
  WHERE status IN ('WAITING', 'ACTIVE')
    AND "gameSessionId" IS NULL
    AND "player2Id" IS NOT NULL
)
UPDATE "CombatSession" AS session
SET
  status = 'FINISHED',
  "endedAt" = COALESCE(session."endedAt", NOW())
FROM ranked_joined_public_combats AS ranked
WHERE session.id = ranked.id
  AND ranked.rn > 1;

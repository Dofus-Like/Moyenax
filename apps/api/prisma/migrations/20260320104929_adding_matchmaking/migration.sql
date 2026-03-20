-- AlterTable
ALTER TABLE "CombatSession" ADD COLUMN     "gameSessionId" TEXT;

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'WAITING',
    "gold" INTEGER NOT NULL DEFAULT 0,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionItem_sessionId_playerId_itemId_key" ON "SessionItem"("sessionId", "playerId", "itemId");

-- AddForeignKey
ALTER TABLE "CombatSession" ADD CONSTRAINT "CombatSession_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CombatSession_status_player2Id_createdAt_idx" ON "CombatSession"("status", "player2Id", "createdAt");

-- CreateIndex
CREATE INDEX "CombatSession_player1Id_status_createdAt_idx" ON "CombatSession"("player1Id", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CombatSession_player2Id_status_createdAt_idx" ON "CombatSession"("player2Id", "status", "createdAt");

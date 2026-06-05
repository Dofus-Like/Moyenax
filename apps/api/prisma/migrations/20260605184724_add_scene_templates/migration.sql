-- CreateTable
CREATE TABLE "SceneTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SceneTemplate_ownerId_idx" ON "SceneTemplate"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneTemplate_ownerId_name_key" ON "SceneTemplate"("ownerId", "name");

-- AddForeignKey
ALTER TABLE "SceneTemplate" ADD CONSTRAINT "SceneTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

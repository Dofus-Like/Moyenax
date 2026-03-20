/*
  Warnings:

  - A unique constraint covering the columns `[playerId,itemId,rank]` on the table `InventoryItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "InventoryItem_playerId_itemId_key";

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "rank" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "PlayerStats" ADD COLUMN     "baseAtk" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "baseDef" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "baseIni" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "baseMag" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "basePa" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "basePm" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "baseRes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "baseVit" INTEGER NOT NULL DEFAULT 100;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_playerId_itemId_rank_key" ON "InventoryItem"("playerId", "itemId", "rank");

/*
  Warnings:

  - You are about to drop the column `equipped` on the `InventoryItem` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EquipmentSlotType" AS ENUM ('WEAPON_LEFT', 'WEAPON_RIGHT', 'ARMOR_HEAD', 'ARMOR_CHEST', 'ARMOR_LEGS', 'ACCESSORY');

-- AlterTable
ALTER TABLE "InventoryItem" DROP COLUMN "equipped";

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "family" TEXT,
ADD COLUMN     "grantsSpells" JSONB;

-- CreateTable
CREATE TABLE "EquipmentSlot" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slot" "EquipmentSlotType" NOT NULL,
    "inventoryItemId" TEXT,

    CONSTRAINT "EquipmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSlot_inventoryItemId_key" ON "EquipmentSlot"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSlot_playerId_slot_key" ON "EquipmentSlot"("playerId", "slot");

-- AddForeignKey
ALTER TABLE "EquipmentSlot" ADD CONSTRAINT "EquipmentSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentSlot" ADD CONSTRAINT "EquipmentSlot_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

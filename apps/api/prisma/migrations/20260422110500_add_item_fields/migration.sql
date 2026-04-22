-- AlterTable
-- This migration adds fields that were present in schema.prisma but missing from the migrations folder,
-- which was causing the CI seed to fail.

ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "family" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "grantsSpells" JSONB;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "iconPath" TEXT;

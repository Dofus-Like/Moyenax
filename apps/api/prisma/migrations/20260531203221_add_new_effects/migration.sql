-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SpellEffectKind" ADD VALUE 'BRULURE';
ALTER TYPE "SpellEffectKind" ADD VALUE 'SAIGNEMENT';
ALTER TYPE "SpellEffectKind" ADD VALUE 'ATTRACTION';
ALTER TYPE "SpellEffectKind" ADD VALUE 'FAIBLESSE';
ALTER TYPE "SpellEffectKind" ADD VALUE 'FRAGILITE';
ALTER TYPE "SpellEffectKind" ADD VALUE 'IGNORANCE';
ALTER TYPE "SpellEffectKind" ADD VALUE 'MALEDICTION';
ALTER TYPE "SpellEffectKind" ADD VALUE 'CECITE';
ALTER TYPE "SpellEffectKind" ADD VALUE 'INACTIVITE';
ALTER TYPE "SpellEffectKind" ADD VALUE 'RALENTISSEMENT';
ALTER TYPE "SpellEffectKind" ADD VALUE 'HEMORRAGIE';

CREATE TYPE "SpellFamily" AS ENUM ('COMMON', 'WARRIOR', 'MAGE', 'NINJA');

CREATE TYPE "SpellEffectKind" AS ENUM (
    'DAMAGE_PHYSICAL',
    'DAMAGE_MAGICAL',
    'HEAL',
    'TELEPORT',
    'BUFF_VIT_MAX',
    'SUMMON_MENHIR',
    'PUSH_LINE',
    'BUFF_PM'
);

ALTER TABLE "Spell"
ADD COLUMN "code" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "family" "SpellFamily" NOT NULL DEFAULT 'COMMON',
ADD COLUMN "iconPath" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "requiresLineOfSight" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "requiresLinearTargeting" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "effectKind" "SpellEffectKind" NOT NULL DEFAULT 'DAMAGE_PHYSICAL',
ADD COLUMN "effectConfig" JSONB,
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Spell"
SET
    "code" = 'spell-frappe',
    "description" = 'Une attaque physique de mêlée.',
    "family" = 'WARRIOR',
    "iconPath" = '/assets/pack/spells/epee.png',
    "sortOrder" = 10,
    "requiresLineOfSight" = true,
    "requiresLinearTargeting" = false,
    "effectKind" = 'DAMAGE_PHYSICAL',
    "effectConfig" = '{}'::jsonb,
    "isDefault" = false
WHERE "name" = 'Frappe';

UPDATE "Spell"
SET
    "code" = 'spell-boule-de-feu',
    "description" = 'Une boule de feu qui frappe à distance.',
    "family" = 'MAGE',
    "iconPath" = '/assets/pack/spells/fireball.png',
    "sortOrder" = 20,
    "requiresLineOfSight" = true,
    "requiresLinearTargeting" = false,
    "effectKind" = 'DAMAGE_MAGICAL',
    "effectConfig" = '{}'::jsonb,
    "isDefault" = false
WHERE "name" = 'Boule de Feu';

UPDATE "Spell"
SET
    "code" = 'spell-kunai',
    "description" = 'Un projectile précis de ninja.',
    "family" = 'NINJA',
    "iconPath" = '/assets/pack/spells/kunai.png',
    "sortOrder" = 30,
    "requiresLineOfSight" = true,
    "requiresLinearTargeting" = false,
    "effectKind" = 'DAMAGE_PHYSICAL',
    "effectConfig" = '{}'::jsonb,
    "isDefault" = false
WHERE "name" = 'Kunai';

UPDATE "Spell"
SET
    "code" = 'spell-soin',
    "description" = 'Un soin mono-cible.',
    "family" = 'MAGE',
    "iconPath" = '/assets/pack/spells/heal.png',
    "sortOrder" = 21,
    "requiresLineOfSight" = true,
    "requiresLinearTargeting" = false,
    "effectKind" = 'HEAL',
    "effectConfig" = '{}'::jsonb,
    "isDefault" = false
WHERE "name" = 'Soin';

UPDATE "Spell"
SET "code" = CONCAT('spell-', regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'))
WHERE "code" IS NULL;

INSERT INTO "Spell" (
    "id",
    "code",
    "name",
    "description",
    "paCost",
    "minRange",
    "maxRange",
    "damageMin",
    "damageMax",
    "cooldown",
    "type",
    "visualType",
    "family",
    "iconPath",
    "sortOrder",
    "requiresLineOfSight",
    "requiresLinearTargeting",
    "effectKind",
    "effectConfig",
    "isDefault"
)
SELECT
    gen_random_uuid(),
    spell_data.code,
    spell_data.name,
    spell_data.description,
    spell_data."paCost",
    spell_data."minRange",
    spell_data."maxRange",
    spell_data."damageMin",
    spell_data."damageMax",
    spell_data.cooldown,
    spell_data.type::"SpellType",
    spell_data."visualType"::"SpellVisualType",
    spell_data.family::"SpellFamily",
    spell_data."iconPath",
    spell_data."sortOrder",
    spell_data."requiresLineOfSight",
    spell_data."requiresLinearTargeting",
    spell_data."effectKind"::"SpellEffectKind",
    spell_data."effectConfig"::jsonb,
    spell_data."isDefault"
FROM (
    VALUES
        (
            'spell-claque',
            'Claque',
            'Une gifle universelle pour ne jamais rester sans action.',
            2,
            1,
            1,
            8,
            12,
            0,
            'DAMAGE',
            'PHYSICAL',
            'COMMON',
            '/assets/pack/spells/epee.png',
            99,
            true,
            false,
            'DAMAGE_PHYSICAL',
            '{}',
            true
        ),
        (
            'spell-bond',
            'Bond',
            'Se téléporte sur une case libre et traversable.',
            4,
            1,
            4,
            0,
            0,
            1,
            'BUFF',
            'UTILITY',
            'WARRIOR',
            '/assets/pack/spells/bond.png',
            11,
            false,
            false,
            'TELEPORT',
            '{}',
            false
        ),
        (
            'spell-endurance',
            'Endurance',
            'Augmente la vitalité maximale pendant le combat.',
            2,
            0,
            0,
            0,
            0,
            2,
            'BUFF',
            'UTILITY',
            'WARRIOR',
            '/assets/pack/spells/endurance.png',
            12,
            true,
            false,
            'BUFF_VIT_MAX',
            '{"buffValue":20,"buffDuration":99}',
            false
        ),
        (
            'spell-menhir',
            'Menhir',
            'Invoque un menhir bloquant sur une case libre.',
            4,
            1,
            3,
            0,
            0,
            1,
            'BUFF',
            'PHYSICAL',
            'MAGE',
            '/assets/pack/spells/menhir.png',
            22,
            true,
            false,
            'SUMMON_MENHIR',
            '{"skin":"menhir","stats":{"vit":1,"atk":0,"mag":0,"def":0,"res":0,"ini":0,"pa":0,"pm":0,"baseVit":1,"baseAtk":0,"baseMag":0,"baseDef":0,"baseRes":0,"baseIni":0,"basePa":0,"basePm":0}}',
            false
        ),
        (
            'spell-bombe-repousse',
            'Bombe repousse',
            'Projette la cible en ligne droite.',
            4,
            1,
            4,
            0,
            0,
            1,
            'DAMAGE',
            'PROJECTILE',
            'NINJA',
            '/assets/pack/spells/bombe.png',
            31,
            true,
            true,
            'PUSH_LINE',
            '{"pushDistance":3}',
            false
        ),
        (
            'spell-velocite',
            'Vélocité',
            'Donne immédiatement des PM supplémentaires.',
            2,
            0,
            0,
            0,
            0,
            1,
            'BUFF',
            'UTILITY',
            'NINJA',
            '/assets/pack/spells/velocite.png',
            32,
            true,
            false,
            'BUFF_PM',
            '{"buffValue":2,"buffDuration":1,"applyImmediately":true}',
            false
        )
) AS spell_data(
    code,
    name,
    description,
    "paCost",
    "minRange",
    "maxRange",
    "damageMin",
    "damageMax",
    cooldown,
    type,
    "visualType",
    family,
    "iconPath",
    "sortOrder",
    "requiresLineOfSight",
    "requiresLinearTargeting",
    "effectKind",
    "effectConfig",
    "isDefault"
)
WHERE NOT EXISTS (
    SELECT 1
    FROM "Spell"
    WHERE "Spell"."code" = spell_data.code
);

ALTER TABLE "Spell" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Spell_code_key" ON "Spell"("code");

CREATE TABLE "ItemGrantedSpell" (
    "itemId" TEXT NOT NULL,
    "spellId" TEXT NOT NULL,
    CONSTRAINT "ItemGrantedSpell_pkey" PRIMARY KEY ("itemId", "spellId")
);

CREATE INDEX "ItemGrantedSpell_spellId_idx" ON "ItemGrantedSpell"("spellId");

ALTER TABLE "ItemGrantedSpell"
ADD CONSTRAINT "ItemGrantedSpell_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ItemGrantedSpell"
ADD CONSTRAINT "ItemGrantedSpell_spellId_fkey"
FOREIGN KEY ("spellId") REFERENCES "Spell"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ItemGrantedSpell" ("itemId", "spellId")
SELECT item_rows."itemId", spell_rows."spellId"
FROM (
    VALUES
        ('Anneau du Guerrier', 'spell-frappe'),
        ('Anneau du Guerrier', 'spell-bond'),
        ('Anneau du Guerrier', 'spell-endurance'),
        ('Anneau du Mage', 'spell-boule-de-feu'),
        ('Anneau du Mage', 'spell-soin'),
        ('Anneau du Mage', 'spell-menhir'),
        ('Anneau du Ninja', 'spell-kunai'),
        ('Anneau du Ninja', 'spell-bombe-repousse'),
        ('Anneau du Ninja', 'spell-velocite'),
        ('Anneau pénien', 'spell-frappe'),
        ('Anneau pénien', 'spell-bond'),
        ('Anneau pénien', 'spell-endurance'),
        ('Anneau pénien', 'spell-boule-de-feu'),
        ('Anneau pénien', 'spell-soin'),
        ('Anneau pénien', 'spell-menhir'),
        ('Anneau pénien', 'spell-kunai'),
        ('Anneau pénien', 'spell-bombe-repousse'),
        ('Anneau pénien', 'spell-velocite')
) AS requested("itemName", "spellCode")
JOIN LATERAL (
    SELECT "id" AS "itemId"
    FROM "Item"
    WHERE "name" = requested."itemName"
) AS item_rows ON true
JOIN LATERAL (
    SELECT "id" AS "spellId"
    FROM "Spell"
    WHERE "code" = requested."spellCode"
) AS spell_rows ON true
ON CONFLICT DO NOTHING;

DELETE FROM "PlayerSpell";

INSERT INTO "PlayerSpell" ("playerId", "spellId", "level")
SELECT "playerId", "spellId", 1
FROM (
    SELECT p."id" AS "playerId", s."id" AS "spellId"
    FROM "Player" p
    JOIN "Spell" s ON s."isDefault" = true

    UNION

    SELECT DISTINCT
        es."playerId",
        igs."spellId"
    FROM "EquipmentSlot" es
    LEFT JOIN "InventoryItem" ii ON ii."id" = es."inventoryItemId"
    LEFT JOIN "SessionItem" si ON si."id" = es."sessionItemId"
    JOIN "ItemGrantedSpell" igs ON igs."itemId" = COALESCE(ii."itemId", si."itemId")
) AS granted_spells;

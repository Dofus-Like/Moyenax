import {
  PrismaClient,
  ItemType,
  SpellType,
  SpellVisualType,
  EquipmentSlotType,
  SpellFamily,
  SpellEffectKind,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { createDefaultPlayerStats } from '../src/player/default-player-stats';

const prisma = new PrismaClient();

const SPELL_DEFINITIONS = [
  {
    code: 'spell-claque',
    name: 'Claque',
    description: 'Une gifle universelle pour ne jamais rester sans action.',
    paCost: 2,
    minRange: 1,
    maxRange: 1,
    damageMin: 8,
    damageMax: 12,
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PHYSICAL,
    family: SpellFamily.COMMON,
    iconPath: '/assets/pack/spells/epee.png',
    sortOrder: 99,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
    effectConfig: {},
    isDefault: true,
  },
  {
    code: 'spell-frappe',
    name: 'Frappe',
    description: 'Une attaque physique de mêlée.',
    paCost: 3,
    minRange: 1,
    maxRange: 1,
    damageMin: 35,
    damageMax: 45,
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PHYSICAL,
    family: SpellFamily.WARRIOR,
    iconPath: '/assets/pack/spells/epee.png',
    sortOrder: 10,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
    effectConfig: {},
    isDefault: false,
  },
  {
    code: 'spell-bond',
    name: 'Bond',
    description: 'Se téléporte sur une case libre et traversable.',
    paCost: 4,
    minRange: 1,
    maxRange: 4,
    damageMin: 0,
    damageMax: 0,
    cooldown: 1,
    type: SpellType.BUFF,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.WARRIOR,
    iconPath: '/assets/pack/spells/bond.png',
    sortOrder: 11,
    requiresLineOfSight: false,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.TELEPORT,
    effectConfig: {},
    isDefault: false,
  },
  {
    code: 'spell-endurance',
    name: 'Endurance',
    description: 'Augmente la vitalité maximale pendant le combat.',
    paCost: 2,
    minRange: 0,
    maxRange: 0,
    damageMin: 0,
    damageMax: 0,
    cooldown: 2,
    type: SpellType.BUFF,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.WARRIOR,
    iconPath: '/assets/pack/spells/endurance.png',
    sortOrder: 12,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.BUFF_VIT_MAX,
    effectConfig: { buffValue: 20, buffDuration: 99 },
    isDefault: false,
  },
  {
    code: 'spell-boule-de-feu',
    name: 'Boule de Feu',
    description: 'Une boule de feu qui frappe à distance.',
    paCost: 3,
    minRange: 1,
    maxRange: 7,
    damageMin: 25,
    damageMax: 35,
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PROJECTILE,
    family: SpellFamily.MAGE,
    iconPath: '/assets/pack/spells/fireball.png',
    sortOrder: 20,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_MAGICAL,
    effectConfig: {},
    isDefault: false,
  },
  {
    code: 'spell-soin',
    name: 'Soin',
    description: 'Un soin mono-cible.',
    paCost: 3,
    minRange: 0,
    maxRange: 4,
    damageMin: 15,
    damageMax: 25,
    cooldown: 1,
    type: SpellType.HEAL,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.MAGE,
    iconPath: '/assets/pack/spells/heal.png',
    sortOrder: 21,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.HEAL,
    effectConfig: {},
    isDefault: false,
  },
  {
    code: 'spell-menhir',
    name: 'Menhir',
    description: 'Invoque un menhir bloquant sur une case libre.',
    paCost: 4,
    minRange: 1,
    maxRange: 3,
    damageMin: 0,
    damageMax: 0,
    cooldown: 1,
    type: SpellType.BUFF,
    visualType: SpellVisualType.PHYSICAL,
    family: SpellFamily.MAGE,
    iconPath: '/assets/pack/spells/menhir.png',
    sortOrder: 22,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.SUMMON_MENHIR,
    effectConfig: {
      skin: 'menhir',
      stats: {
        vit: 1,
        atk: 0,
        mag: 0,
        def: 0,
        res: 0,
        ini: 0,
        pa: 0,
        pm: 0,
        baseVit: 1,
        baseAtk: 0,
        baseMag: 0,
        baseDef: 0,
        baseRes: 0,
        baseIni: 0,
        basePa: 0,
        basePm: 0,
      },
    },
    isDefault: false,
  },
  {
    code: 'spell-kunai',
    name: 'Kunai',
    description: 'Un projectile précis de ninja.',
    paCost: 3,
    minRange: 1,
    maxRange: 6,
    damageMin: 15,
    damageMax: 20,
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PROJECTILE,
    family: SpellFamily.NINJA,
    iconPath: '/assets/pack/spells/kunai.png',
    sortOrder: 30,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
    effectConfig: {},
    isDefault: false,
  },
  {
    code: 'spell-bombe-repousse',
    name: 'Bombe repousse',
    description: 'Projette la cible en ligne droite.',
    paCost: 4,
    minRange: 1,
    maxRange: 4,
    damageMin: 0,
    damageMax: 0,
    cooldown: 1,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PROJECTILE,
    family: SpellFamily.NINJA,
    iconPath: '/assets/pack/spells/bombe.png',
    sortOrder: 31,
    requiresLineOfSight: true,
    requiresLinearTargeting: true,
    effectKind: SpellEffectKind.PUSH_LINE,
    effectConfig: { pushDistance: 3 },
    isDefault: false,
  },
  {
    code: 'spell-velocite',
    name: 'Vélocité',
    description: 'Donne immédiatement des PM supplémentaires.',
    paCost: 2,
    minRange: 0,
    maxRange: 0,
    damageMin: 0,
    damageMax: 0,
    cooldown: 1,
    type: SpellType.BUFF,
    visualType: SpellVisualType.UTILITY,
    family: SpellFamily.NINJA,
    iconPath: '/assets/pack/spells/velocite.png',
    sortOrder: 32,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.BUFF_PM,
    effectConfig: { buffValue: 2, buffDuration: 1, applyImmediately: true },
    isDefault: false,
  },
] as const;

async function rebuildPlayerSpellsForPlayer(playerId: string) {
  const [defaultSpells, equippedSlots] = await Promise.all([
    prisma.spell.findMany({
      where: { isDefault: true },
      select: { id: true },
    }),
    prisma.equipmentSlot.findMany({
      where: {
        playerId,
        OR: [{ inventoryItemId: { not: null } }, { sessionItemId: { not: null } }],
      },
      select: {
        inventoryItem: { select: { itemId: true } },
        sessionItem: { select: { itemId: true } },
      },
    }),
  ]);

  const itemIds = [
    ...new Set(
      equippedSlots
        .map((slot) => slot.inventoryItem?.itemId ?? slot.sessionItem?.itemId ?? null)
        .filter((itemId): itemId is string => itemId !== null),
    ),
  ];

  const itemGrantedSpells = itemIds.length
    ? await prisma.itemGrantedSpell.findMany({
        where: { itemId: { in: itemIds } },
        select: { spellId: true },
      })
    : [];

  const spellIds = [
    ...new Set([
      ...defaultSpells.map((spell) => spell.id),
      ...itemGrantedSpells.map((entry) => entry.spellId),
    ]),
  ];

  await prisma.playerSpell.deleteMany({
    where: { playerId },
  });

  if (spellIds.length > 0) {
    await prisma.playerSpell.createMany({
      data: spellIds.map((spellId) => ({
        playerId,
        spellId,
        level: 1,
      })),
    });
  }
}

async function main() {
  console.warn('🌱 Seeding database...');

  // Only clear volatile session/combat data — catalog and player data are preserved.
  await prisma.combatTurn.deleteMany();
  await prisma.combatSession.deleteMany();
  await prisma.sessionItem.deleteMany();
  await prisma.gameSession.deleteMany();

  // ── Sorts : upsert par code (idempotent) ──────────────────────────
  const spellsByCode = new Map<string, Awaited<ReturnType<typeof prisma.spell.create>>>();
  for (const spellDef of SPELL_DEFINITIONS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spell = await prisma.spell.upsert({
      where: { code: spellDef.code },
      create: { ...spellDef },
      update: { ...spellDef },
    });
    spellsByCode.set(spell.code, spell);
  }

  // ── Ressources : upsert par name ──────────────────────────────────
  const fer = await prisma.item.upsert({
    where: { name: 'Fer' },
    create: {
      name: 'Fer',
      type: ItemType.RESOURCE,
      description:
        "Un morceau de métal qui sent le vieux clou. On raconte qu'il a été forgé avec la sueur d'un nain constipé.",
      iconPath: '/assets/items/fer.png',
    },
    update: {
      iconPath: '/assets/items/fer.png',
      description:
        "Un morceau de métal qui sent le vieux clou. On raconte qu'il a été forgé avec la sueur d'un nain constipé.",
    },
  });

  const cuir = await prisma.item.upsert({
    where: { name: 'Cuir' },
    create: {
      name: 'Cuir',
      type: ItemType.RESOURCE,
      description:
        'Souple et résistant. Parfait pour se faire une armure ou un slip de rechange après un combat intense.',
      iconPath: '/assets/items/cuir.png',
    },
    update: {
      iconPath: '/assets/items/cuir.png',
      description:
        'Souple et résistant. Parfait pour se faire une armure ou un slip de rechange après un combat intense.',
    },
  });

  const cristal = await prisma.item.upsert({
    where: { name: 'Cristal magique' },
    create: {
      name: 'Cristal magique',
      type: ItemType.RESOURCE,
      description:
        'Ça brille, ça coûte cher, et ça fait des étincelles quand on le frotte contre son entrejambe.',
      iconPath: '/assets/items/cristal.png',
    },
    update: {
      iconPath: '/assets/items/cristal.png',
      description:
        'Ça brille, ça coûte cher, et ça fait des étincelles quand on le frotte contre son entrejambe.',
    },
  });

  const etoffe = await prisma.item.upsert({
    where: { name: 'Étoffe' },
    create: {
      name: 'Étoffe',
      type: ItemType.RESOURCE,
      description:
        "Tissu de haute qualité. Idéal pour les mages qui veulent avoir l'air mystérieux sans avoir froid aux fesses.",
      iconPath: '/assets/items/etoffe.png',
    },
    update: {
      iconPath: '/assets/items/etoffe.png',
      description:
        "Tissu de haute qualité. Idéal pour les mages qui veulent avoir l'air mystérieux sans avoir froid aux fesses.",
    },
  });

  const bois = await prisma.item.upsert({
    where: { name: 'Bois' },
    create: {
      name: 'Bois',
      type: ItemType.RESOURCE,
      description: 'Robuste et fibreux. Pourrait servir de gourdin si vous étiez un peu plus barbare.',
      iconPath: '/assets/items/bois.png',
    },
    update: {
      iconPath: '/assets/items/bois.png',
      description: 'Robuste et fibreux. Pourrait servir de gourdin si vous étiez un peu plus barbare.',
    },
  });

  const herbe = await prisma.item.upsert({
    where: { name: 'Herbe médicinale' },
    create: {
      name: 'Herbe médicinale',
      type: ItemType.RESOURCE,
      description: 'Ça soigne les plaies, mais ça donne aussi une haleine de poney mort.',
      iconPath: '/assets/items/herbe.png',
    },
    update: {
      iconPath: '/assets/items/herbe.png',
      description: 'Ça soigne les plaies, mais ça donne aussi une haleine de poney mort.',
    },
  });

  const or = await prisma.item.upsert({
    where: { name: 'Or' },
    create: {
      name: 'Or',
      type: ItemType.RESOURCE,
      description:
        "Le nerf de la guerre. Et l'ami des gens qui n'ont rien d'autre à offrir que leur portefeuille.",
      iconPath: '/assets/items/or.png',
    },
    update: {
      iconPath: '/assets/items/or.png',
      description:
        "Le nerf de la guerre. Et l'ami des gens qui n'ont rien d'autre à offrir que leur portefeuille.",
    },
  });

  // ── Armes ─────────────────────────────────────────────────────────

  const epee = await prisma.item.upsert({
    where: { name: 'Épée' },
    create: {
      name: 'Épée',
      type: ItemType.WEAPON,
      description:
        'Tranchante, mais surtout utile pour couper le saucisson... ou les doigts des imprudents.',
      statsBonus: { atk: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 50,
      iconPath: '/assets/items/epee.png',
    },
    update: {
      iconPath: '/assets/items/epee.png',
      shopPrice: 50,
      statsBonus: { atk: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      description:
        'Tranchante, mais surtout utile pour couper le saucisson... ou les doigts des imprudents.',
    },
  });

  const bouclier = await prisma.item.upsert({
    where: { name: 'Bouclier' },
    create: {
      name: 'Bouclier',
      type: ItemType.WEAPON,
      description:
        "Plus efficace qu'une planche en bois, mais moins qu'un mur en briques. Protège le devant, le reste est à vos risques et périls.",
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 1, [cuir.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/bouclier.png',
    },
    update: {
      iconPath: '/assets/items/bouclier.png',
      shopPrice: 50,
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 1, [cuir.id]: 2 },
      description:
        "Plus efficace qu'une planche en bois, mais moins qu'un mur en briques. Protège le devant, le reste est à vos risques et périls.",
    },
  });

  const baton = await prisma.item.upsert({
    where: { name: 'Bâton magique' },
    create: {
      name: 'Bâton magique',
      type: ItemType.WEAPON,
      description:
        "L'extrémité brille quand on pense très fort à du fromage. Ou à autre chose de plus intime.",
      statsBonus: { mag: 5 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/baton.png',
    },
    update: {
      iconPath: '/assets/items/baton.png',
      shopPrice: 50,
      statsBonus: { mag: 5 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 2 },
      description:
        "L'extrémité brille quand on pense très fort à du fromage. Ou à autre chose de plus intime.",
    },
  });

  const grimoire = await prisma.item.upsert({
    where: { name: 'Grimoire' },
    create: {
      name: 'Grimoire',
      type: ItemType.WEAPON,
      description: 'Contient des sorts puissants et des recettes de cuisine douteuses.',
      statsBonus: { mag: 3, res: 2 },
      craftCost: { [cristal.id]: 2, [etoffe.id]: 1 },
      shopPrice: 50,
      iconPath: '/assets/items/grimoire.png',
    },
    update: {
      iconPath: '/assets/items/grimoire.png',
      shopPrice: 50,
      statsBonus: { mag: 3, res: 2 },
      craftCost: { [cristal.id]: 2, [etoffe.id]: 1 },
      description: 'Contient des sorts puissants et des recettes de cuisine douteuses.',
    },
  });

  const kunai = await prisma.item.upsert({
    where: { name: 'Kunaï' },
    create: {
      name: 'Kunaï',
      type: ItemType.WEAPON,
      description:
        'Petit, pointu, et facile à cacher. Comme le respect de vos ennemis après une défaite.',
      statsBonus: { atk: 3, ini: 2 },
      craftCost: { [fer.id]: 2, [bois.id]: 1 },
      shopPrice: 50,
      iconPath: '/assets/items/kunai.png',
    },
    update: {
      iconPath: '/assets/items/kunai.png',
      shopPrice: 50,
      statsBonus: { atk: 3, ini: 2 },
      craftCost: { [fer.id]: 2, [bois.id]: 1 },
      description:
        'Petit, pointu, et facile à cacher. Comme le respect de vos ennemis après une défaite.',
    },
  });

  const bombe = await prisma.item.upsert({
    where: { name: 'Bombe ninja' },
    create: {
      name: 'Bombe ninja',
      type: ItemType.WEAPON,
      description:
        "Fait 'Pouf' et vous voilà disparu. Ou alors vous avez juste l'air idiot au milieu d'un nuage de fumée.",
      statsBonus: { atk: 2, ini: 3 },
      craftCost: { [bois.id]: 1, [herbe.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/bombe.png',
    },
    update: {
      iconPath: '/assets/items/bombe.png',
      shopPrice: 50,
      statsBonus: { atk: 2, ini: 3 },
      craftCost: { [bois.id]: 1, [herbe.id]: 2 },
      description:
        "Fait 'Pouf' et vous voilà disparu. Ou alors vous avez juste l'air idiot au milieu d'un nuage de fumée.",
    },
  });

  // ── Armures tête ───────────────────────────────────────────────────

  const heaume = await prisma.item.upsert({
    where: { name: 'Heaume' },
    create: {
      name: 'Heaume',
      type: ItemType.ARMOR_HEAD,
      description:
        "Protège votre tête, mais limite votre champ de vision à celui d'un cyclope bourré.",
      statsBonus: { def: 3 },
      craftCost: { [fer.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/heaume.png',
    },
    update: {
      iconPath: '/assets/items/heaume.png',
      shopPrice: 50,
      statsBonus: { def: 3 },
      craftCost: { [fer.id]: 2 },
      description:
        "Protège votre tête, mais limite votre champ de vision à celui d'un cyclope bourré.",
    },
  });

  const chapeau = await prisma.item.upsert({
    where: { name: 'Chapeau de mage' },
    create: {
      name: 'Chapeau de mage',
      type: ItemType.ARMOR_HEAD,
      description: 'Plus le chapeau est pointu, plus le mage est... compensatoire.',
      statsBonus: { res: 3 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 1 },
      shopPrice: 50,
      iconPath: '/assets/items/chapeau.png',
    },
    update: {
      iconPath: '/assets/items/chapeau.png',
      shopPrice: 50,
      statsBonus: { res: 3 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 1 },
      description: 'Plus le chapeau est pointu, plus le mage est... compensatoire.',
    },
  });

  const bandeau = await prisma.item.upsert({
    where: { name: 'Bandeau' },
    create: {
      name: 'Bandeau',
      type: ItemType.ARMOR_HEAD,
      description:
        'Donne un air de ninja ténébreux, mais sert surtout à éponger la sueur de la peur.',
      statsBonus: { ini: 3 },
      craftCost: { [cuir.id]: 1, [bois.id]: 1 },
      shopPrice: 50,
      iconPath: '/assets/items/bandeau.png',
    },
    update: {
      iconPath: '/assets/items/bandeau.png',
      shopPrice: 50,
      statsBonus: { ini: 3 },
      craftCost: { [cuir.id]: 1, [bois.id]: 1 },
      description:
        'Donne un air de ninja ténébreux, mais sert surtout à éponger la sueur de la peur.',
    },
  });

  // ── Armures torse ──────────────────────────────────────────────────

  const armure = await prisma.item.upsert({
    where: { name: 'Armure' },
    create: {
      name: 'Armure',
      type: ItemType.ARMOR_CHEST,
      description: "Du métal lourd pour gens qui n'ont pas peur de couler au fond de l'eau.",
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 50,
      iconPath: '/assets/items/armure.png',
    },
    update: {
      iconPath: '/assets/items/armure.png',
      shopPrice: 50,
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      description: "Du métal lourd pour gens qui n'ont pas peur de couler au fond de l'eau.",
    },
  });

  const toge = await prisma.item.upsert({
    where: { name: 'Toge de mage' },
    create: {
      name: 'Toge de mage',
      type: ItemType.ARMOR_CHEST,
      description: 'Très aéré. Un peu trop quand il y a du vent.',
      statsBonus: { res: 5 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/toge.png',
    },
    update: {
      iconPath: '/assets/items/toge.png',
      shopPrice: 50,
      statsBonus: { res: 5 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 2 },
      description: 'Très aéré. Un peu trop quand il y a du vent.',
    },
  });

  const kimono = await prisma.item.upsert({
    where: { name: 'Kimono' },
    create: {
      name: 'Kimono',
      type: ItemType.ARMOR_CHEST,
      description: 'Élégant et léger. Parfait pour les acrobaties et les fuites désespérées.',
      statsBonus: { ini: 3, pm: 1 },
      craftCost: { [cuir.id]: 1, [bois.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/kimono.png',
    },
    update: {
      iconPath: '/assets/items/kimono.png',
      shopPrice: 50,
      statsBonus: { ini: 3, pm: 1 },
      craftCost: { [cuir.id]: 1, [bois.id]: 2 },
      description: 'Élégant et léger. Parfait pour les acrobaties et les fuites désespérées.',
    },
  });

  // ── Armures jambes ─────────────────────────────────────────────────

  const bottesFer = await prisma.item.upsert({
    where: { name: 'Bottes de fer' },
    create: {
      name: 'Bottes de fer',
      type: ItemType.ARMOR_LEGS,
      description: 'Pour écraser les orteils avec autorité. Interdit dans les soirées dansantes.',
      statsBonus: { def: 2, pm: 1 },
      craftCost: { [fer.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/bottesFer.png',
    },
    update: {
      iconPath: '/assets/items/bottesFer.png',
      shopPrice: 50,
      statsBonus: { def: 2, pm: 1 },
      craftCost: { [fer.id]: 2 },
      description: 'Pour écraser les orteils avec autorité. Interdit dans les soirées dansantes.',
    },
  });

  const bottesMage = await prisma.item.upsert({
    where: { name: 'Bottes de mage' },
    create: {
      name: 'Bottes de mage',
      type: ItemType.ARMOR_LEGS,
      description:
        "Permettent de marcher sur l'eau, ou au moins de ne pas se mouiller les chaussettes dans l'herbe haute.",
      statsBonus: { res: 2, pm: 1 },
      craftCost: { [etoffe.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/bottesMage.png',
    },
    update: {
      iconPath: '/assets/items/bottesMage.png',
      shopPrice: 50,
      statsBonus: { res: 2, pm: 1 },
      craftCost: { [etoffe.id]: 2 },
      description:
        "Permettent de marcher sur l'eau, ou au moins de ne pas se mouiller les chaussettes dans l'herbe haute.",
    },
  });

  const geta = await prisma.item.upsert({
    where: { name: 'Geta' },
    create: {
      name: 'Geta',
      type: ItemType.ARMOR_LEGS,
      description:
        "Clac-clac-clac. Le bruit de la mort qui arrive... ou d'un touriste en vacances.",
      statsBonus: { pm: 2 },
      craftCost: { [bois.id]: 2 },
      shopPrice: 50,
      iconPath: '/assets/items/geta.png',
    },
    update: {
      iconPath: '/assets/items/geta.png',
      shopPrice: 50,
      statsBonus: { pm: 2 },
      craftCost: { [bois.id]: 2 },
      description:
        "Clac-clac-clac. Le bruit de la mort qui arrive... ou d'un touriste en vacances.",
    },
  });

  // ── Anneaux ────────────────────────────────────────────────────────

  const anneauGuerrier = await prisma.item.upsert({
    where: { name: 'Anneau du Guerrier' },
    create: {
      name: 'Anneau du Guerrier',
      type: ItemType.ACCESSORY,
      description:
        'Augmente la force brute. Attention : ne pas se curer le nez avec, sous peine de luxation.',
      statsBonus: { vit: 85, atk: 20, def: 10, pa: 1 },
      craftCost: { [fer.id]: 2, [or.id]: 2 },
      shopPrice: 180,
      iconPath: '/assets/items/anneauGuerrier.png',
    },
    update: {
      iconPath: '/assets/items/anneauGuerrier.png',
      shopPrice: 180,
      statsBonus: { vit: 85, atk: 20, def: 10, pa: 1 },
      craftCost: { [fer.id]: 2, [or.id]: 2 },
      description:
        'Augmente la force brute. Attention : ne pas se curer le nez avec, sous peine de luxation.',
    },
  });

  const anneauMage = await prisma.item.upsert({
    where: { name: 'Anneau du Mage' },
    create: {
      name: 'Anneau du Mage',
      type: ItemType.ACCESSORY,
      description: 'Fait circuler le mana. Et provoque des picotements bizarres dans les mains.',
      statsBonus: { vit: 40, mag: 25, res: 15, pa: 1 },
      craftCost: { [cristal.id]: 2, [or.id]: 2 },
      shopPrice: 180,
      iconPath: '/assets/items/anneauMage.png',
    },
    update: {
      iconPath: '/assets/items/anneauMage.png',
      shopPrice: 180,
      statsBonus: { vit: 40, mag: 25, res: 15, pa: 1 },
      craftCost: { [cristal.id]: 2, [or.id]: 2 },
      description: 'Fait circuler le mana. Et provoque des picotements bizarres dans les mains.',
    },
  });

  const anneauNinja = await prisma.item.upsert({
    where: { name: 'Anneau du Ninja' },
    create: {
      name: 'Anneau du Ninja',
      type: ItemType.ACCESSORY,
      description:
        "Rend plus agile. Ou alors c'est juste l'effet placebo de porter un truc brillant.",
      statsBonus: { vit: 50, atk: 15, mag: 5, ini: 50, pm: 1, pa: 1 },
      craftCost: { [cuir.id]: 1, [bois.id]: 1, [or.id]: 2 },
      shopPrice: 180,
      iconPath: '/assets/items/anneauNinja.png',
    },
    update: {
      iconPath: '/assets/items/anneauNinja.png',
      shopPrice: 180,
      statsBonus: { vit: 50, atk: 15, mag: 5, ini: 50, pm: 1, pa: 1 },
      craftCost: { [cuir.id]: 1, [bois.id]: 1, [or.id]: 2 },
      description:
        "Rend plus agile. Ou alors c'est juste l'effet placebo de porter un truc brillant.",
    },
  });

  const anneauPenien = await prisma.item.upsert({
    where: { name: 'Anneau pénien' },
    create: {
      name: 'Anneau pénien',
      type: ItemType.ACCESSORY,
      description:
        "Un anneau moulé directement sur l'artisan le plus expérimenté de Vergeronce. Il paraît qu'il procure un bonus de 'Vigueur' insoupçonné.",
      statsBonus: { vit: 9999, atk: 999, mag: 999, def: 100, res: 100, pa: 12, pm: 12 },
      shopPrice: 500,
      iconPath: '/assets/items/anneauPenien.png',
    },
    update: {
      iconPath: '/assets/items/anneauPenien.png',
      shopPrice: 500,
      statsBonus: { vit: 9999, atk: 999, mag: 999, def: 100, res: 100, pa: 12, pm: 12 },
      description:
        "Un anneau moulé directement sur l'artisan le plus expérimenté de Vergeronce. Il paraît qu'il procure un bonus de 'Vigueur' insoupçonné.",
    },
  });

  // ItemGrantedSpell: delete+recreate for anneaux (no unique constraint on itemId+spellId)
  const anneauIds = [anneauGuerrier.id, anneauMage.id, anneauNinja.id, anneauPenien.id];
  await prisma.itemGrantedSpell.deleteMany({ where: { itemId: { in: anneauIds } } });
  await prisma.itemGrantedSpell.createMany({
    data: [
      { itemId: anneauGuerrier.id, spellId: spellsByCode.get('spell-frappe')!.id },
      { itemId: anneauGuerrier.id, spellId: spellsByCode.get('spell-bond')!.id },
      { itemId: anneauGuerrier.id, spellId: spellsByCode.get('spell-endurance')!.id },
      { itemId: anneauMage.id, spellId: spellsByCode.get('spell-boule-de-feu')!.id },
      { itemId: anneauMage.id, spellId: spellsByCode.get('spell-soin')!.id },
      { itemId: anneauMage.id, spellId: spellsByCode.get('spell-menhir')!.id },
      { itemId: anneauNinja.id, spellId: spellsByCode.get('spell-kunai')!.id },
      { itemId: anneauNinja.id, spellId: spellsByCode.get('spell-bombe-repousse')!.id },
      { itemId: anneauNinja.id, spellId: spellsByCode.get('spell-velocite')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-frappe')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-bond')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-endurance')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-boule-de-feu')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-soin')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-menhir')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-kunai')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-bombe-repousse')!.id },
      { itemId: anneauPenien.id, spellId: spellsByCode.get('spell-velocite')!.id },
    ],
  });

  // ── Consommables ───────────────────────────────────────────────────

  await prisma.item.upsert({
    where: { name: 'Potion de Soin' },
    create: {
      name: 'Potion de Soin',
      type: ItemType.CONSUMABLE,
      description:
        'Boire cul-sec pour refermer ses plaies. Goût fraise des bois et vieux pansement.',
      statsBonus: { healVit: 30 },
      craftCost: { [herbe.id]: 2 },
      shopPrice: 15,
      iconPath: '/assets/items/potionSoin.png',
    },
    update: {
      iconPath: '/assets/items/potionSoin.png',
      shopPrice: 15,
      statsBonus: { healVit: 30 },
      craftCost: { [herbe.id]: 2 },
      description:
        'Boire cul-sec pour refermer ses plaies. Goût fraise des bois et vieux pansement.',
    },
  });

  await prisma.item.upsert({
    where: { name: 'Potion de Force' },
    create: {
      name: 'Potion de Force',
      type: ItemType.CONSUMABLE,
      description:
        'Vous donne des muscles en carton pendant 3 minutes. Attention au contrecoup sur votre dignité.',
      statsBonus: { buffAttaque: 5, buffDuree: 3 },
      craftCost: { [fer.id]: 1, [herbe.id]: 1 },
      shopPrice: 15,
      iconPath: '/assets/items/potionForce.png',
    },
    update: {
      iconPath: '/assets/items/potionForce.png',
      shopPrice: 15,
      statsBonus: { buffAttaque: 5, buffDuree: 3 },
      craftCost: { [fer.id]: 1, [herbe.id]: 1 },
      description:
        'Vous donne des muscles en carton pendant 3 minutes. Attention au contrecoup sur votre dignité.',
    },
  });

  await prisma.item.upsert({
    where: { name: 'Potion de Vitesse' },
    create: {
      name: 'Potion de Vitesse',
      type: ItemType.CONSUMABLE,
      description: 'Pour courir plus vite que son ombre. Ou que sa propre honte.',
      statsBonus: { buffPM: 2, buffDuree: 2 },
      craftCost: { [bois.id]: 1, [herbe.id]: 1 },
      shopPrice: 15,
      iconPath: '/assets/items/potionVitesse.png',
    },
    update: {
      iconPath: '/assets/items/potionVitesse.png',
      shopPrice: 15,
      statsBonus: { buffPM: 2, buffDuree: 2 },
      craftCost: { [bois.id]: 1, [herbe.id]: 1 },
      description: 'Pour courir plus vite que son ombre. Ou que sa propre honte.',
    },
  });

  // ── Joueurs de test : find-or-create (préserve les vraies données) ──

  const passwordHash = await bcrypt.hash('password123', 10);

  const warriorExists = await prisma.player.findUnique({ where: { email: 'warrior@test.com' } });
  if (!warriorExists) {
    const warrior = await prisma.player.create({
      data: {
        username: 'Warrior',
        email: 'warrior@test.com',
        passwordHash,
        gold: 100,
        stats: { create: createDefaultPlayerStats() },
        inventory: {
          create: [
            { itemId: epee.id, quantity: 1 },
            { itemId: bouclier.id, quantity: 1 },
            { itemId: heaume.id, quantity: 1 },
            { itemId: armure.id, quantity: 1 },
            { itemId: bottesFer.id, quantity: 1 },
            { itemId: anneauGuerrier.id, quantity: 1 },
            { itemId: anneauPenien.id, quantity: 1 },
          ],
        },
      },
    });
    const warriorInv = await prisma.inventoryItem.findMany({ where: { playerId: warrior.id } });
    await prisma.equipmentSlot.create({
      data: {
        playerId: warrior.id,
        slot: EquipmentSlotType.ACCESSORY,
        inventoryItemId: warriorInv.find((i) => i.itemId === anneauGuerrier.id)?.id,
      },
    });
    await rebuildPlayerSpellsForPlayer(warrior.id);
  }

  const mageExists = await prisma.player.findUnique({ where: { email: 'mage@test.com' } });
  if (!mageExists) {
    const mage = await prisma.player.create({
      data: {
        username: 'Mage',
        email: 'mage@test.com',
        passwordHash,
        gold: 100,
        stats: { create: createDefaultPlayerStats() },
        inventory: {
          create: [
            { itemId: baton.id, quantity: 1 },
            { itemId: grimoire.id, quantity: 1 },
            { itemId: chapeau.id, quantity: 1 },
            { itemId: toge.id, quantity: 1 },
            { itemId: bottesMage.id, quantity: 1 },
            { itemId: anneauMage.id, quantity: 1 },
          ],
        },
      },
    });
    const mageInv = await prisma.inventoryItem.findMany({ where: { playerId: mage.id } });
    await prisma.equipmentSlot.create({
      data: {
        playerId: mage.id,
        slot: EquipmentSlotType.ACCESSORY,
        inventoryItemId: mageInv.find((i) => i.itemId === anneauMage.id)?.id,
      },
    });
    await rebuildPlayerSpellsForPlayer(mage.id);
  }

  const ninjaExists = await prisma.player.findUnique({ where: { email: 'ninja@test.com' } });
  if (!ninjaExists) {
    const ninja = await prisma.player.create({
      data: {
        username: 'Ninja',
        email: 'ninja@test.com',
        passwordHash,
        gold: 100,
        stats: { create: createDefaultPlayerStats() },
        inventory: {
          create: [
            { itemId: kunai.id, quantity: 1 },
            { itemId: bombe.id, quantity: 1 },
            { itemId: bandeau.id, quantity: 1 },
            { itemId: kimono.id, quantity: 1 },
            { itemId: geta.id, quantity: 1 },
            { itemId: anneauNinja.id, quantity: 1 },
          ],
        },
      },
    });
    const ninjaInv = await prisma.inventoryItem.findMany({ where: { playerId: ninja.id } });
    await prisma.equipmentSlot.create({
      data: {
        playerId: ninja.id,
        slot: EquipmentSlotType.ACCESSORY,
        inventoryItemId: ninjaInv.find((i) => i.itemId === anneauNinja.id)?.id,
      },
    });
    await rebuildPlayerSpellsForPlayer(ninja.id);
  }

  const trollExists = await prisma.player.findUnique({ where: { email: 'troll@test.com' } });
  if (!trollExists) {
    const troll = await prisma.player.create({
      data: {
        username: 'Troll pénien',
        email: 'troll@test.com',
        passwordHash,
        gold: 100,
        skin: 'orc-blood',
        stats: { create: createDefaultPlayerStats() },
        inventory: {
          create: [
            { itemId: anneauPenien.id, quantity: 1 },
            { itemId: or.id, quantity: 69 },
          ],
        },
      },
    });
    const trollInv = await prisma.inventoryItem.findMany({ where: { playerId: troll.id } });
    await prisma.equipmentSlot.create({
      data: {
        playerId: troll.id,
        slot: EquipmentSlotType.ACCESSORY,
        inventoryItemId: trollInv.find((i) => i.itemId === anneauPenien.id)?.id,
      },
    });
    await rebuildPlayerSpellsForPlayer(troll.id);
  }

  const itemCount = await prisma.item.count();
  const spellCount = await prisma.spell.count();
  console.warn('✅ Seed completed!');
  console.warn(`   Items: ${itemCount}`);
  console.warn(`   Spells: ${spellCount}`);
  console.warn(`   Players: Warrior, Mage, Ninja, Troll pénien (skipped if already exist)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

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
    paCost: 2,
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

  const itemIds = [...new Set(
    equippedSlots
      .map((slot) => slot.inventoryItem?.itemId ?? slot.sessionItem?.itemId ?? null)
      .filter((itemId): itemId is string => itemId !== null),
  )];

  const itemGrantedSpells = itemIds.length
    ? await prisma.itemGrantedSpell.findMany({
        where: { itemId: { in: itemIds } },
        select: { spellId: true },
      })
    : [];

  const spellIds = [...new Set([
    ...defaultSpells.map((spell) => spell.id),
    ...itemGrantedSpells.map((entry) => entry.spellId),
  ])];

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
  console.log('🌱 Seeding database...');

  // Nettoyage (ordre inverse des clés étrangères)
  await prisma.combatTurn.deleteMany();
  await prisma.combatSession.deleteMany();
  await prisma.sessionItem.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.playerSpell.deleteMany();
  await prisma.itemGrantedSpell.deleteMany();
  await prisma.equipmentSlot.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.playerStats.deleteMany();
  await prisma.player.deleteMany();
  await prisma.item.deleteMany();
  await prisma.spell.deleteMany();

  // ── Sorts de base ──────────────────────────────────────────────────
  const spellsByCode = new Map<string, Awaited<ReturnType<typeof prisma.spell.create>>>();
  for (const spellDefinition of SPELL_DEFINITIONS) {
    const spell = await prisma.spell.create({
      data: spellDefinition,
    });
    spellsByCode.set(spell.code, spell);
  }

  // ── Ressources ──────────────────────────────────────────────────

  const fer = await prisma.item.create({
    data: { name: 'Fer', type: ItemType.RESOURCE, description: 'Un morceau de métal qui sent le vieux clou. On raconte qu\'il a été forgé avec la sueur d\'un nain constipé.', iconPath: '/assets/items/fer.png' },
  });

  const cuir = await prisma.item.create({
    data: { name: 'Cuir', type: ItemType.RESOURCE, description: 'Souple et résistant. Parfait pour se faire une armure ou un slip de rechange après un combat intense.', iconPath: '/assets/items/cuir.png' },
  });
  const cristal = await prisma.item.create({
    data: { name: 'Cristal magique', type: ItemType.RESOURCE, description: 'Ça brille, ça coûte cher, et ça fait des étincelles quand on le frotte contre son entrejambe.', iconPath: '/assets/items/cristal.png' },
  });
  const etoffe = await prisma.item.create({
    data: { name: 'Étoffe', type: ItemType.RESOURCE, description: 'Tissu de haute qualité. Idéal pour les mages qui veulent avoir l\'air mystérieux sans avoir froid aux fesses.', iconPath: '/assets/items/etoffe.png' },
  });
  const bois = await prisma.item.create({
    data: { name: 'Bois', type: ItemType.RESOURCE, description: 'Robuste et fibreux. Pourrait servir de gourdin si vous étiez un peu plus barbare.', iconPath: '/assets/items/bois.png' },
  });
  const herbe = await prisma.item.create({
    data: { name: 'Herbe médicinale', type: ItemType.RESOURCE, description: 'Ça soigne les plaies, mais ça donne aussi une haleine de poney mort.', iconPath: '/assets/items/herbe.png' },
  });
  const or = await prisma.item.create({
    data: { name: 'Or', type: ItemType.RESOURCE, description: 'Le nerf de la guerre. Et l\'ami des gens qui n\'ont rien d\'autre à offrir que leur portefeuille.', iconPath: '/assets/items/or.png' },
  });

  // ── Armes : boutique 25 Po (max 2 pièces d’équipement par victoire à +50 Po) ──

  const epee = await prisma.item.create({
    data: {
      name: 'Épée',
      type: ItemType.WEAPON,
      description: "Tranchante, mais surtout utile pour couper le saucisson... ou les doigts des imprudents.",
      statsBonus: { atk: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 25,
      iconPath: '/assets/items/epee.png',
    },
  });

  const bouclier = await prisma.item.create({
    data: {
      name: 'Bouclier',
      type: ItemType.WEAPON,
      description: "Plus efficace qu'une planche en bois, mais moins qu'un mur en briques. Protège le devant, le reste est à vos risques et périls.",
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 1, [cuir.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/bouclier.png',
    },
  });

  const baton = await prisma.item.create({
    data: {
      name: 'Bâton magique',
      type: ItemType.WEAPON,
      description: "L'extrémité brille quand on pense très fort à du fromage. Ou à autre chose de plus intime.",
      statsBonus: { mag: 5 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/baton.png',
    },
  });

  const grimoire = await prisma.item.create({
    data: {
      name: 'Grimoire',
      type: ItemType.WEAPON,
      description: "Contient des sorts puissants et des recettes de cuisine douteuses.",
      statsBonus: { mag: 3, res: 2 },
      craftCost: { [cristal.id]: 2, [etoffe.id]: 1 },
      shopPrice: 25,
      iconPath: '/assets/items/grimoire.png',
    },
  });

  const kunai = await prisma.item.create({
    data: {
      name: 'Kunaï',
      type: ItemType.WEAPON,
      description: "Petit, pointu, et facile à cacher. Comme le respect de vos ennemis après une défaite.",
      statsBonus: { atk: 3, ini: 2 },
      craftCost: { [fer.id]: 2, [bois.id]: 1 },
      shopPrice: 25,
      iconPath: '/assets/items/kunai.png',
    },
  });

  const bombe = await prisma.item.create({
    data: {
      name: 'Bombe ninja',
      type: ItemType.WEAPON,
      description: "Fait 'Pouf' et vous voilà disparu. Ou alors vous avez juste l'air idiot au milieu d'un nuage de fumée.",
      statsBonus: { atk: 2, ini: 3 },
      craftCost: { [bois.id]: 1, [herbe.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/bombe.png',
    },
  });

  // ── Armures tête (Cout 2u) ─────────────────────────

  const heaume = await prisma.item.create({
    data: {
      name: 'Heaume',
      type: ItemType.ARMOR_HEAD,
      description: "Protège votre tête, mais limite votre champ de vision à celui d'un cyclope bourré.",
      statsBonus: { def: 3 },
      craftCost: { [fer.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/heaume.png',
    },
  });

  const chapeau = await prisma.item.create({
    data: {
      name: 'Chapeau de mage',
      type: ItemType.ARMOR_HEAD,
      description: "Plus le chapeau est pointu, plus le mage est... compensatoire.",
      statsBonus: { res: 3 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 1 },
      shopPrice: 25,
      iconPath: '/assets/items/chapeau.png',
    },
  });

  const bandeau = await prisma.item.create({
    data: {
      name: 'Bandeau',
      type: ItemType.ARMOR_HEAD,
      description: "Donne un air de ninja ténébreux, mais sert surtout à éponger la sueur de la peur.",
      statsBonus: { ini: 3 },
      craftCost: { [cuir.id]: 1, [bois.id]: 1 },
      shopPrice: 25,
      iconPath: '/assets/items/bandeau.png',
    },
  });

  // ── Armures torse (Cout 3u) ────────────────────────

  const armure = await prisma.item.create({
    data: {
      name: 'Armure',
      type: ItemType.ARMOR_CHEST,
      description: "Du métal lourd pour gens qui n'ont pas peur de couler au fond de l'eau.",
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 25,
      iconPath: '/assets/items/armure.png',
    },
  });

  const toge = await prisma.item.create({
    data: {
      name: 'Toge de mage',
      type: ItemType.ARMOR_CHEST,
      description: "Très aéré. Un peu trop quand il y a du vent.",
      statsBonus: { res: 5 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/toge.png',
    },
  });

  const kimono = await prisma.item.create({
    data: {
      name: 'Kimono',
      type: ItemType.ARMOR_CHEST,
      description: "Élégant et léger. Parfait pour les acrobaties et les fuites désespérées.",
      statsBonus: { ini: 3, pm: 1 },
      craftCost: { [cuir.id]: 1, [bois.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/kimono.png',
    },
  });

  // ── Armures jambes (Cout 2u) ───────────────────────

  const bottesFer = await prisma.item.create({
    data: {
      name: 'Bottes de fer',
      type: ItemType.ARMOR_LEGS,
      description: "Pour écraser les orteils avec autorité. Interdit dans les soirées dansantes.",
      statsBonus: { def: 2, pm: 1 },
      craftCost: { [fer.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/bottesFer.png',
    },
  });

  const bottesMage = await prisma.item.create({
    data: {
      name: 'Bottes de mage',
      type: ItemType.ARMOR_LEGS,
      description: "Permettent de marcher sur l'eau, ou au moins de ne pas se mouiller les chaussettes dans l'herbe haute.",
      statsBonus: { res: 2, pm: 1 },
      craftCost: { [etoffe.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/bottesMage.png',
    },
  });

  const geta = await prisma.item.create({
    data: {
      name: 'Geta',
      type: ItemType.ARMOR_LEGS,
      description: "Clac-clac-clac. Le bruit de la mort qui arrive... ou d'un touriste en vacances.",
      statsBonus: { pm: 2 },
      craftCost: { [bois.id]: 2 },
      shopPrice: 25,
      iconPath: '/assets/items/geta.png',
    },
  });

  // ── Anneaux (Cout 2u famille + 2 Or) ───────────────

  const anneauGuerrier = await prisma.item.create({
    data: {
      name: 'Anneau du Guerrier',
      type: ItemType.ACCESSORY,
      description: "Augmente la force brute. Attention : ne pas se curer le nez avec, sous peine de luxation.",
      statsBonus: { vit: 100, atk: 20, def: 10, pa: 1 },
      craftCost: { [fer.id]: 2, [or.id]: 2 },
      shopPrice: 350,
      iconPath: '/assets/items/anneauGuerrier.png',
    },
  });

  const anneauMage = await prisma.item.create({
    data: {
      name: 'Anneau du Mage',
      type: ItemType.ACCESSORY,
      description: "Fait circuler le mana. Et provoque des picotements bizarres dans les mains.",
      statsBonus: { vit: 50, mag: 30, res: 15, pa: 1 },
      craftCost: { [cristal.id]: 2, [or.id]: 2 },
      shopPrice: 350,
      iconPath: '/assets/items/anneauMage.png',
    },
  });

  const anneauNinja = await prisma.item.create({
    data: {
      name: 'Anneau du Ninja',
      type: ItemType.ACCESSORY,
      description: "Rend plus agile. Ou alors c'est juste l'effet placebo de porter un truc brillant.",
      statsBonus: { vit: 50, atk: 15, mag: 5, ini: 50, pm: 1 },
      craftCost: { [cuir.id]: 1, [bois.id]: 1, [or.id]: 2 },
      shopPrice: 350,
      iconPath: '/assets/items/anneauNinja.png',
    },
  });

  const anneauPenien = await prisma.item.create({
    data: {
      name: 'Anneau pénien',
      type: ItemType.ACCESSORY,
      description: "Un anneau moulé directement sur l'artisan le plus expérimenté de Vergeronce. Il paraît qu'il procure un bonus de 'Vigueur' insoupçonné.",
      statsBonus: { vit: 9999, atk: 999, mag: 999, def: 100, res: 100, pa: 12, pm: 12 },
      shopPrice: 500,
      iconPath: '/assets/items/anneauPenien.png',
    },
  });

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

  // ── Consommables : prix bas pour ne pas grignoter le budget équipement ──

  await prisma.item.create({
    data: {
      name: 'Potion de Soin',
      type: ItemType.CONSUMABLE,
      description: "Boire cul-sec pour refermer ses plaies. Goût fraise des bois et vieux pansement.",
      statsBonus: { healVit: 30 },
      craftCost: { [herbe.id]: 2 },
      shopPrice: 8,
      iconPath: '/assets/items/potionSoin.png',
    },
  });

  await prisma.item.create({
    data: {
      name: 'Potion de Force',
      type: ItemType.CONSUMABLE,
      description: "Vous donne des muscles en carton pendant 3 minutes. Attention au contrecoup sur votre dignité.",
      statsBonus: { buffAttaque: 5, buffDuree: 3 },
      craftCost: { [fer.id]: 1, [herbe.id]: 1 },
      shopPrice: 8,
      iconPath: '/assets/items/potionForce.png',
    },
  });

  await prisma.item.create({
    data: {
      name: 'Potion de Vitesse',
      type: ItemType.CONSUMABLE,
      description: "Pour courir plus vite que son ombre. Ou que sa propre honte.",
      statsBonus: { buffPM: 2, buffDuree: 2 },
      craftCost: { [bois.id]: 1, [herbe.id]: 1 },
      shopPrice: 8,
      iconPath: '/assets/items/potionVitesse.png',
    },
  });

  // ── Joueurs de test ──────────────────────────────────────────────

  const passwordHash = await bcrypt.hash('password123', 10);

  const warrior = await prisma.player.create({
    data: {
      username: 'Warrior',
      email: 'warrior@test.com',
      passwordHash,
      gold: 100,
      stats: {
        create: createDefaultPlayerStats(),
      },

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

  // Seul l'anneau est équipé
  const warriorInv = await prisma.inventoryItem.findMany({ where: { playerId: warrior.id } });
  await prisma.equipmentSlot.create({
    data: { playerId: warrior.id, slot: EquipmentSlotType.ACCESSORY, inventoryItemId: warriorInv.find(i => i.itemId === anneauGuerrier.id)?.id }
  });

  const mage = await prisma.player.create({
    data: {
      username: 'Mage',
      email: 'mage@test.com',
      passwordHash,
      gold: 100,
      stats: {
        create: createDefaultPlayerStats(),
      },

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
    data: { playerId: mage.id, slot: EquipmentSlotType.ACCESSORY, inventoryItemId: mageInv.find(i => i.itemId === anneauMage.id)?.id }
  });

  const ninja = await prisma.player.create({
    data: {
      username: 'Ninja',
      email: 'ninja@test.com',
      passwordHash,
      gold: 100,
      stats: {
        create: createDefaultPlayerStats(),
      },
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
    data: { playerId: ninja.id, slot: EquipmentSlotType.ACCESSORY, inventoryItemId: ninjaInv.find(i => i.itemId === anneauNinja.id)?.id }
  });

  const troll = await prisma.player.create({
    data: {
      username: 'Troll pénien',
      email: 'troll@test.com',
      passwordHash,
      gold: 100,
      skin: 'orc-blood',
      stats: {
        create: createDefaultPlayerStats(),
      },
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
      inventoryItemId: trollInv.find(i => i.itemId === anneauPenien.id)?.id 
    }
  });

  await Promise.all([
    rebuildPlayerSpellsForPlayer(warrior.id),
    rebuildPlayerSpellsForPlayer(mage.id),
    rebuildPlayerSpellsForPlayer(ninja.id),
    rebuildPlayerSpellsForPlayer(troll.id),
  ]);

  const itemCount = await prisma.item.count();
  const spellCount = await prisma.spell.count();
  console.log('✅ Seed completed!');
  console.log(`   Items: ${itemCount}`);
  console.log(`   Spells: ${spellCount}`);
  console.log(`   Players: Warrior, Mage, Ninja, Troll pénien`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

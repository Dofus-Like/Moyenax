import { PrismaClient, ItemType, SpellType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Nettoyage (ordre inverse des clés étrangères)
  await prisma.combatTurn.deleteMany();
  await prisma.combatSession.deleteMany();
  await prisma.playerSpell.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.playerStats.deleteMany();
  await prisma.player.deleteMany();
  await prisma.item.deleteMany();
  await prisma.spell.deleteMany();

  // Sorts de base
  const fireball = await prisma.spell.create({
    data: {
      name: 'Boule de Feu',
      paCost: 4,
      minRange: 1,
      maxRange: 5,
      damageMin: 15,
      damageMax: 25,
      cooldown: 1,
      type: SpellType.DAMAGE,
    },
  });

  // ── Ressources ──────────────────────────────────────────────────

  const fer = await prisma.item.create({
    data: { name: 'Fer', type: ItemType.RESOURCE },
  });
  const cuir = await prisma.item.create({
    data: { name: 'Cuir', type: ItemType.RESOURCE },
  });
  const cristal = await prisma.item.create({
    data: { name: 'Cristal magique', type: ItemType.RESOURCE },
  });
  const etoffe = await prisma.item.create({
    data: { name: 'Étoffe', type: ItemType.RESOURCE },
  });
  const bois = await prisma.item.create({
    data: { name: 'Bois', type: ItemType.RESOURCE },
  });
  const herbe = await prisma.item.create({
    data: { name: 'Herbe médicinale', type: ItemType.RESOURCE },
  });
  const or = await prisma.item.create({
    data: { name: 'Or', type: ItemType.RESOURCE },
  });

  // ── Armes (craft 3u → shop 4 Or) ───────────────────────────────

  const epee = await prisma.item.create({
    data: {
      name: 'Épée',
      type: ItemType.WEAPON,
      statsBonus: { atk: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 4,
    },
  });

  const bouclier = await prisma.item.create({
    data: {
      name: 'Bouclier',
      type: ItemType.WEAPON,
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 3 },
      shopPrice: 4,
    },
  });

  const baton = await prisma.item.create({
    data: {
      name: 'Bâton magique',
      type: ItemType.WEAPON,
      statsBonus: { mag: 5 },
      craftCost: { [cristal.id]: 2, [etoffe.id]: 1 },
      shopPrice: 4,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Grimoire',
      type: ItemType.WEAPON,
      statsBonus: { mag: 3, res: 2 },
      craftCost: { [cristal.id]: 3 },
      shopPrice: 4,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Kunaï',
      type: ItemType.WEAPON,
      statsBonus: { atk: 3, ini: 2 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 4,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Bombe ninja',
      type: ItemType.WEAPON,
      statsBonus: { atk: 2, ini: 3 },
      craftCost: { [herbe.id]: 2, [bois.id]: 1 },
      shopPrice: 4,
    },
  });

  // ── Armures tête (craft 2u → shop 3 Or) ─────────────────────────

  const heaume = await prisma.item.create({
    data: {
      name: 'Heaume',
      type: ItemType.ARMOR_HEAD,
      statsBonus: { def: 3 },
      craftCost: { [fer.id]: 2 },
      shopPrice: 3,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Chapeau de mage',
      type: ItemType.ARMOR_HEAD,
      statsBonus: { res: 3 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 1 },
      shopPrice: 3,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Bandeau',
      type: ItemType.ARMOR_HEAD,
      statsBonus: { ini: 3 },
      craftCost: { [cuir.id]: 2 },
      shopPrice: 3,
    },
  });

  // ── Armures torse (craft 3u → shop 4 Or) ────────────────────────

  const armure = await prisma.item.create({
    data: {
      name: 'Armure',
      type: ItemType.ARMOR_CHEST,
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 4,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Toge de mage',
      type: ItemType.ARMOR_CHEST,
      statsBonus: { res: 5 },
      craftCost: { [etoffe.id]: 3 },
      shopPrice: 4,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Kimono',
      type: ItemType.ARMOR_CHEST,
      statsBonus: { ini: 3, pm: 1 },
      craftCost: { [bois.id]: 2, [cuir.id]: 1 },
      shopPrice: 4,
    },
  });

  // ── Armures jambes (craft 2u → shop 3 Or) ───────────────────────

  const bottes = await prisma.item.create({
    data: {
      name: 'Bottes de fer',
      type: ItemType.ARMOR_LEGS,
      statsBonus: { def: 2, pm: 1 },
      craftCost: { [fer.id]: 1, [cuir.id]: 1 },
      shopPrice: 3,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Bottes de mage',
      type: ItemType.ARMOR_LEGS,
      statsBonus: { res: 2, pm: 1 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 1 },
      shopPrice: 3,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Geta',
      type: ItemType.ARMOR_LEGS,
      statsBonus: { pm: 2 },
      craftCost: { [bois.id]: 2 },
      shopPrice: 3,
    },
  });

  // ── Anneaux (craft 4u: 2 res + 2 Or → shop 5 Or) ───────────────

  const anneauGuerrier = await prisma.item.create({
    data: {
      name: 'Anneau du Guerrier',
      type: ItemType.ACCESSORY,
      statsBonus: { def: 3, pm: 1 },
      craftCost: { [fer.id]: 2, [or.id]: 2 },
      shopPrice: 5,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Anneau du Mage',
      type: ItemType.ACCESSORY,
      statsBonus: { mag: 3, pa: 1 },
      craftCost: { [cristal.id]: 2, [or.id]: 2 },
      shopPrice: 5,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Anneau du Ninja',
      type: ItemType.ACCESSORY,
      statsBonus: { ini: 3, pm: 1 },
      craftCost: { [cuir.id]: 2, [or.id]: 2 },
      shopPrice: 5,
    },
  });

  // ── Consommables (craft 2u → shop 3 Or) ─────────────────────────

  await prisma.item.create({
    data: {
      name: 'Potion de Soin',
      type: ItemType.CONSUMABLE,
      statsBonus: { healVit: 30 },
      craftCost: { [herbe.id]: 2 },
      shopPrice: 3,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Potion de Force',
      type: ItemType.CONSUMABLE,
      statsBonus: { buffAttaque: 5, buffDuree: 3 },
      craftCost: { [herbe.id]: 1, [cristal.id]: 1 },
      shopPrice: 3,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Potion de Vitesse',
      type: ItemType.CONSUMABLE,
      statsBonus: { buffPM: 2, buffDuree: 2 },
      craftCost: { [herbe.id]: 1, [cuir.id]: 1 },
      shopPrice: 3,
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
        create: {
          vit: 100,
          atk: 5,
          mag: 0,
          def: 0,
          res: 0,
          ini: 10,
          pa: 6,
          pm: 3,
        },
      },
      inventory: {
        create: [
          { itemId: epee.id, quantity: 1, equipped: true },
          { itemId: bouclier.id, quantity: 1, equipped: true },
          { itemId: heaume.id, quantity: 1, equipped: true },
          { itemId: armure.id, quantity: 1, equipped: true },
          { itemId: bottes.id, quantity: 1, equipped: true },
          { itemId: anneauGuerrier.id, quantity: 1, equipped: true },
        ],
      },
    },
  });

  const mage = await prisma.player.create({
    data: {
      username: 'Mage',
      email: 'mage@test.com',
      passwordHash,
      gold: 100,
      stats: {
        create: {
          vit: 80,
          atk: 2,
          mag: 8,
          def: 0,
          res: 2,
          ini: 12,
          pa: 7,
          pm: 3,
        },
      },
      inventory: {
        create: [
          { itemId: baton.id, quantity: 1, equipped: true },
        ],
      },
    },
  });

  const itemCount = await prisma.item.count();
  console.log('✅ Seed completed!');
  console.log(`   Items: ${itemCount} (7 resources + 6 weapons + 9 armors + 3 rings + 3 consumables)`);
  console.log(`   Players: ${warrior.username}, ${mage.username}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

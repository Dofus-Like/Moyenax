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

  // Sorts de base (utilisés si on ne suit pas strictement le système de déblocage par item pour le test)
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

  // Items GDD Rang 1
  const epee = await prisma.item.create({
    data: {
      name: 'Épée de Bronze',
      type: ItemType.WEAPON,
      statsBonus: { atk: 4, vit: 5 },
      shopPrice: 50,
      rank: 1,
    },
  });

  const bouclier = await prisma.item.create({
    data: {
      name: 'Bouclier en Bois',
      type: ItemType.WEAPON,
      statsBonus: { def: 4, vit: 10 },
      shopPrice: 50,
      rank: 1,
    },
  });

  const baton = await prisma.item.create({
    data: {
      name: 'Bâton Magique',
      type: ItemType.WEAPON,
      statsBonus: { mag: 6, ini: 2 },
      shopPrice: 60,
      rank: 1,
    },
  });

  const heaume = await prisma.item.create({
    data: {
      name: 'Heaume de Fer',
      type: ItemType.ARMOR_HEAD,
      statsBonus: { def: 2, vit: 10 },
      rank: 1,
    },
  });

  const armure = await prisma.item.create({
    data: {
      name: 'Armure de Fer',
      type: ItemType.ARMOR_CHEST,
      statsBonus: { def: 3, vit: 15 },
      rank: 1,
    },
  });

  const bottes = await prisma.item.create({
    data: {
      name: 'Bottes de Fer',
      type: ItemType.ARMOR_LEGS,
      statsBonus: { def: 2, pm: 1 },
      rank: 1,
    },
  });

  const anneauGuerrier = await prisma.item.create({
      data: {
          name: 'Anneau de Guerrier',
          type: ItemType.ACCESSORY,
          statsBonus: { def: 3, pm: 1 },
          rank: 1
      }
  });

  // Ressources
  await prisma.item.create({
    data: { name: 'Bois de Frêne', type: ItemType.RESOURCE, shopPrice: 5 },
  });
  await prisma.item.create({
    data: { name: 'Minerai de Fer', type: ItemType.RESOURCE, shopPrice: 10 },
  });

  // Joueurs de test
  const passwordHash = await bcrypt.hash('password123', 10);

  const warrior = await prisma.player.create({
    data: {
      username: 'Warrior',
      email: 'warrior@test.com',
      passwordHash,
      gold: 500,
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
      gold: 500,
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

  console.log('✅ Seed completed!');
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

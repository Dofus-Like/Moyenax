import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Créer les items
  const sword = await prisma.item.create({
    data: {
      name: 'Épée de Bronze',
      type: 'WEAPON',
      statsBonus: { strength: 5 },
      shopPrice: 50,
    },
  });

  const armor = await prisma.item.create({
    data: {
      name: 'Armure de Cuir',
      type: 'ARMOR',
      statsBonus: { hp: 20, maxHp: 20 },
      shopPrice: 80,
    },
  });

  const ring = await prisma.item.create({
    data: {
      name: 'Anneau d\'Agilité',
      type: 'RING',
      statsBonus: { agility: 3, initiative: 2 },
      shopPrice: 120,
    },
  });

  const wood = await prisma.item.create({
    data: {
      name: 'Bois de Frêne',
      type: 'RESOURCE',
      shopPrice: 5,
    },
  });

  const iron = await prisma.item.create({
    data: {
      name: 'Minerai de Fer',
      type: 'RESOURCE',
      shopPrice: 10,
    },
  });

  // Créer les sorts
  const fireball = await prisma.spell.create({
    data: {
      name: 'Boule de Feu',
      apCost: 4,
      minRange: 1,
      maxRange: 5,
      damageMin: 15,
      damageMax: 25,
      cooldown: 1,
      type: 'DAMAGE',
    },
  });

  const heal = await prisma.spell.create({
    data: {
      name: 'Soin Léger',
      apCost: 3,
      minRange: 0,
      maxRange: 3,
      damageMin: 10,
      damageMax: 18,
      cooldown: 2,
      type: 'HEAL',
    },
  });

  const buff = await prisma.spell.create({
    data: {
      name: 'Renforcement',
      apCost: 2,
      minRange: 0,
      maxRange: 1,
      damageMin: 0,
      damageMax: 0,
      cooldown: 3,
      type: 'BUFF',
    },
  });

  // Créer les joueurs de test
  const passwordHash = await bcrypt.hash('password123', 10);

  const player1 = await prisma.player.create({
    data: {
      username: 'Warrior',
      email: 'warrior@test.com',
      passwordHash,
      gold: 500,
      stats: {
        create: {
          baseHp: 120,
          baseAp: 6,
          baseMp: 3,
          strength: 14,
          agility: 8,
          initiative: 10,
        },
      },
      spells: {
        create: [{ spellId: fireball.id }],
      },
      inventory: {
        create: [
          { itemId: sword.id, quantity: 1, equipped: true },
          { itemId: wood.id, quantity: 10 },
        ],
      },
    },
  });

  const player2 = await prisma.player.create({
    data: {
      username: 'Mage',
      email: 'mage@test.com',
      passwordHash,
      gold: 500,
      stats: {
        create: {
          baseHp: 80,
          baseAp: 8,
          baseMp: 5,
          strength: 8,
          agility: 14,
          initiative: 12,
        },
      },
      spells: {
        create: [
          { spellId: fireball.id },
          { spellId: heal.id },
          { spellId: buff.id },
        ],
      },
      inventory: {
        create: [
          { itemId: ring.id, quantity: 1, equipped: true },
          { itemId: iron.id, quantity: 5 },
        ],
      },
    },
  });

  console.log('✅ Seed completed!');
  console.log(`   Players: ${player1.username}, ${player2.username}`);
  console.log(`   Items: ${sword.name}, ${armor.name}, ${ring.name}, ${wood.name}, ${iron.name}`);
  console.log(`   Spells: ${fireball.name}, ${heal.name}, ${buff.name}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

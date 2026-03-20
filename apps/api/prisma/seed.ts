import { PrismaClient, ItemType, SpellType, SpellVisualType, EquipmentSlotType } from '@prisma/client';
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

  // ── Sorts de base ──────────────────────────────────────────────────

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
      visualType: SpellVisualType.PROJECTILE,
    },
  });

  const kunaiSpell = await prisma.spell.create({
    data: {
      name: 'Kunai',
      paCost: 3,
      minRange: 2,
      maxRange: 4,
      damageMin: 10,
      damageMax: 18,
      cooldown: 0,
      type: SpellType.DAMAGE,
      visualType: SpellVisualType.PROJECTILE,
    },
  });

  const heal = await prisma.spell.create({
    data: {
      name: 'Soin',
      paCost: 3,
      minRange: 0,
      maxRange: 4,
      damageMin: -10,
      damageMax: -20,
      cooldown: 1,
      type: SpellType.HEAL,
      visualType: SpellVisualType.UTILITY,
    },
  });

  const frappe = await prisma.spell.create({
    data: {
      name: 'Frappe',
      paCost: 3,
      minRange: 1,
      maxRange: 1,
      damageMin: 12,
      damageMax: 22,
      cooldown: 0,
      type: SpellType.DAMAGE,
      visualType: SpellVisualType.PHYSICAL,
    },
  });

  // ── Ressources ──────────────────────────────────────────────────

  const fer = await prisma.item.create({
    data: { name: 'Fer', type: ItemType.RESOURCE, description: 'Un morceau de métal qui sent le vieux clou.' },
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

  // ── Armes (Cout 3u) ───────────────────────────────

  const epee = await prisma.item.create({
    data: {
      name: 'Épée',
      type: ItemType.WEAPON,
      description: "Tranchante, mais surtout utile pour couper le saucisson.",
      statsBonus: { atk: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 4,
    },
  });

  const bouclier = await prisma.item.create({
    data: {
      name: 'Bouclier',
      type: ItemType.WEAPON,
      description: "Plus efficace qu'une planche en bois, mais moins qu'un mur en briques.",
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 1, [cuir.id]: 2 },
      shopPrice: 4,
    },
  });

  const baton = await prisma.item.create({
    data: {
      name: 'Bâton magique',
      type: ItemType.WEAPON,
      description: "L'extrémité brille quand on pense très fort à du fromage.",
      statsBonus: { mag: 5 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 2 },
      shopPrice: 4,
    },
  });

  const grimoire = await prisma.item.create({
    data: {
      name: 'Grimoire',
      type: ItemType.WEAPON,
      statsBonus: { mag: 3, res: 2 },
      craftCost: { [cristal.id]: 2, [etoffe.id]: 1 },
      shopPrice: 4,
    },
  });

  const kunai = await prisma.item.create({
    data: {
      name: 'Kunaï',
      type: ItemType.WEAPON,
      statsBonus: { atk: 3, ini: 2 },
      craftCost: { [fer.id]: 2, [bois.id]: 1 },
      shopPrice: 4,
    },
  });

  const bombe = await prisma.item.create({
    data: {
      name: 'Bombe ninja',
      type: ItemType.WEAPON,
      statsBonus: { atk: 2, ini: 3 },
      craftCost: { [bois.id]: 1, [herbe.id]: 2 },
      shopPrice: 4,
    },
  });

  // ── Armures tête (Cout 2u) ─────────────────────────

  const heaume = await prisma.item.create({
    data: {
      name: 'Heaume',
      type: ItemType.ARMOR_HEAD,
      statsBonus: { def: 3 },
      craftCost: { [fer.id]: 2 },
      shopPrice: 3,
    },
  });

  const chapeau = await prisma.item.create({
    data: {
      name: 'Chapeau de mage',
      type: ItemType.ARMOR_HEAD,
      statsBonus: { res: 3 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 1 },
      shopPrice: 3,
    },
  });

  const bandeau = await prisma.item.create({
    data: {
      name: 'Bandeau',
      type: ItemType.ARMOR_HEAD,
      statsBonus: { ini: 3 },
      craftCost: { [cuir.id]: 1, [bois.id]: 1 },
      shopPrice: 3,
    },
  });

  // ── Armures torse (Cout 3u) ────────────────────────

  const armure = await prisma.item.create({
    data: {
      name: 'Armure',
      type: ItemType.ARMOR_CHEST,
      statsBonus: { def: 5 },
      craftCost: { [fer.id]: 2, [cuir.id]: 1 },
      shopPrice: 4,
    },
  });

  const toge = await prisma.item.create({
    data: {
      name: 'Toge de mage',
      type: ItemType.ARMOR_CHEST,
      statsBonus: { res: 5 },
      craftCost: { [cristal.id]: 1, [etoffe.id]: 2 },
      shopPrice: 4,
    },
  });

  const kimono = await prisma.item.create({
    data: {
      name: 'Kimono',
      type: ItemType.ARMOR_CHEST,
      statsBonus: { ini: 3, pm: 1 },
      craftCost: { [cuir.id]: 1, [bois.id]: 2 },
      shopPrice: 4,
    },
  });

  // ── Armures jambes (Cout 2u) ───────────────────────

  const bottesFer = await prisma.item.create({
    data: {
      name: 'Bottes de fer',
      type: ItemType.ARMOR_LEGS,
      statsBonus: { def: 2, pm: 1 },
      craftCost: { [fer.id]: 2 },
      shopPrice: 3,
    },
  });

  const bottesMage = await prisma.item.create({
    data: {
      name: 'Bottes de mage',
      type: ItemType.ARMOR_LEGS,
      statsBonus: { res: 2, pm: 1 },
      craftCost: { [etoffe.id]: 2 },
      shopPrice: 3,
    },
  });

  const geta = await prisma.item.create({
    data: {
      name: 'Geta',
      type: ItemType.ARMOR_LEGS,
      statsBonus: { pm: 2 },
      craftCost: { [bois.id]: 2 },
      shopPrice: 3,
    },
  });

  // ── Anneaux (Cout 2u famille + 2 Or) ───────────────

  const anneauGuerrier = await prisma.item.create({
    data: {
      name: 'Anneau du Guerrier',
      type: ItemType.ACCESSORY,
      statsBonus: { vit: 100, atk: 20, def: 10, pa: 1 },
      grantsSpells: ['spell-frappe', 'spell-bond', 'spell-endurance'],
      craftCost: { [fer.id]: 2, [or.id]: 2 },
      shopPrice: 5,
    },
  });

  const anneauMage = await prisma.item.create({
    data: {
      name: 'Anneau du Mage',
      type: ItemType.ACCESSORY,
      statsBonus: { vit: 50, mag: 30, res: 15, pa: 1 },
      grantsSpells: ['spell-boule-de-feu', 'spell-soin', 'spell-menhir'],
      craftCost: { [cristal.id]: 2, [or.id]: 2 },
      shopPrice: 5,
    },
  });

  const anneauNinja = await prisma.item.create({
    data: {
      name: 'Anneau du Ninja',
      type: ItemType.ACCESSORY,
      statsBonus: { vit: 50, atk: 15, mag: 5, ini: 500, pm: 1 },
      grantsSpells: ['spell-kunai', 'spell-bombe-repousse', 'spell-velocite'],
      craftCost: { [cuir.id]: 1, [bois.id]: 1, [or.id]: 2 },
      shopPrice: 5,
    },
  });

  const anneauPenien = await prisma.item.create({
    data: {
      name: 'Anneau pénien',
      type: ItemType.ACCESSORY,
      description: "Un anneau moulé directement sur l'artisan le plus expérimenté de Vergeronce",
      statsBonus: { vit: 9999, atk: 999, mag: 999, def: 100, res: 100, pa: 12, pm: 12 },
      grantsSpells: ['*'],
      shopPrice: 69,
    },
  });

  // ── Consommables (Cout 2u) ─────────────────────────

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
      craftCost: { [fer.id]: 1, [herbe.id]: 1 },
      shopPrice: 3,
    },
  });

  await prisma.item.create({
    data: {
      name: 'Potion de Vitesse',
      type: ItemType.CONSUMABLE,
      statsBonus: { buffPM: 2, buffDuree: 2 },
      craftCost: { [bois.id]: 1, [herbe.id]: 1 },
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
          vit: 100, atk: 10, mag: 10, def: 5, res: 5, ini: 100, pa: 6, pm: 3,
          baseVit: 100, baseAtk: 10, baseMag: 10, baseDef: 5, baseRes: 5, baseIni: 100, basePa: 6, basePm: 3,
        },
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
        create: {
          vit: 100, atk: 10, mag: 10, def: 5, res: 5, ini: 100, pa: 6, pm: 3,
          baseVit: 100, baseAtk: 10, baseMag: 10, baseDef: 5, baseRes: 5, baseIni: 100, basePa: 6, basePm: 3,
        },
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
        create: {
          vit: 100, atk: 10, mag: 10, def: 5, res: 5, ini: 100, pa: 6, pm: 3,
          baseVit: 100, baseAtk: 10, baseMag: 10, baseDef: 5, baseRes: 5, baseIni: 100, basePa: 6, basePm: 3,
        },
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
        create: {
          vit: 100, atk: 10, mag: 10, def: 5, res: 5, ini: 100, pa: 6, pm: 3,
          baseVit: 100, baseAtk: 10, baseMag: 10, baseDef: 5, baseRes: 5, baseIni: 100, basePa: 6, basePm: 3,
        },
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

  const itemCount = await prisma.item.count();
  console.log('✅ Seed completed!');
  console.log(`   Items: ${itemCount}`);
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

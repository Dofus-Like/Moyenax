import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const updates: Array<{ name: string; iconPath: string }> = [
    // Ressources
    { name: 'Fer', iconPath: '/assets/items/fer.png' },
    { name: 'Cuir', iconPath: '/assets/items/cuir.png' },
    { name: 'Cristal magique', iconPath: '/assets/items/cristal.png' },
    { name: 'Étoffe', iconPath: '/assets/items/etoffe.png' },
    { name: 'Bois', iconPath: '/assets/items/bois.png' },
    { name: 'Herbe médicinale', iconPath: '/assets/items/herbe.png' },
    { name: 'Or', iconPath: '/assets/items/or.png' },
    // Armes
    { name: 'Épée', iconPath: '/assets/items/epee.png' },
    { name: 'Bouclier', iconPath: '/assets/items/bouclier.png' },
    // Coiffes
    { name: 'Heaume', iconPath: '/assets/items/heaume.png' },
    { name: 'Chapeau de mage', iconPath: '/assets/items/chapeau.png' },
    // Accessoires
    { name: 'Anneau pénien', iconPath: '/assets/items/anneau_penien.png' },
  ];

  for (const { name, iconPath } of updates) {
    const result = await prisma.item.updateMany({ where: { name }, data: { iconPath } });
    console.warn(`${name}: ${result.count} row(s) updated → ${iconPath}`);
  }
  console.warn('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

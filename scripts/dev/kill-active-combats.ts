import { PrismaClient, SessionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const openStatuses = [SessionStatus.WAITING, SessionStatus.ACTIVE];

  const combats = await prisma.combatSession.findMany({
    where: { status: { in: openStatuses } },
    select: { id: true, status: true, player1Id: true, player2Id: true, createdAt: true },
  });

  if (combats.length === 0) {
    console.log('Aucun combat actif ou en attente trouvé.');
  } else {
    console.log(`Combats à terminer: ${combats.length}`);
    for (const c of combats) {
      console.log(
        `  - ${c.id} [${c.status}] p1=${c.player1Id} p2=${c.player2Id ?? '∅'} createdAt=${c.createdAt.toISOString()}`,
      );
    }
    const result = await prisma.combatSession.updateMany({
      where: { status: { in: openStatuses } },
      data: { status: SessionStatus.FINISHED, endedAt: now },
    });
    console.log(`✔ ${result.count} combat(s) terminé(s).`);
  }

  const rooms = await prisma.gameSession.findMany({
    where: { status: { in: openStatuses } },
    select: { id: true, status: true, phase: true, player1Id: true, player2Id: true, createdAt: true },
  });

  if (rooms.length === 0) {
    console.log('Aucune room (GameSession) ouverte trouvée.');
  } else {
    console.log(`Rooms à fermer: ${rooms.length}`);
    for (const r of rooms) {
      console.log(
        `  - ${r.id} [${r.status}/${r.phase}] p1=${r.player1Id} p2=${r.player2Id ?? '∅'} createdAt=${r.createdAt.toISOString()}`,
      );
    }
    const result = await prisma.gameSession.updateMany({
      where: { status: { in: openStatuses } },
      data: { status: SessionStatus.FINISHED, endedAt: now },
    });
    console.log(`✔ ${result.count} room(s) fermée(s).`);
  }

  console.log(`Terminé à ${now.toISOString()}.`);
}

main()
  .catch((err) => {
    console.error('Erreur lors du kill des combats:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

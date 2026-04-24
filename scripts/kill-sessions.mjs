/**
 * Kill all active game sessions.
 * Sets WAITING/ACTIVE GameSession and CombatSession to FINISHED.
 *
 * Usage: dotenv -e .env -- node scripts/kill-sessions.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const [combats, sessions] = await Promise.all([
    prisma.combatSession.updateMany({
      where: { status: { in: ['WAITING', 'ACTIVE'] } },
      data: { status: 'FINISHED', endedAt: now },
    }),
    prisma.gameSession.updateMany({
      where: { status: { in: ['WAITING', 'ACTIVE'] } },
      data: { status: 'FINISHED', endedAt: now },
    }),
  ]);

  console.log(`GameSessions terminées  : ${sessions.count}`);
  console.log(`CombatSessions terminées: ${combats.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

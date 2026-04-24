import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';
import {
  ensurePerfDir,
  perfDir,
  runCommand,
  startCommandServer,
  stopApiServer,
  timestampId,
  writeJson,
  writeJsonl,
} from './lib.mjs';

const prisma = new PrismaClient();

async function measureSeedCheck() {
  const startedAt = performance.now();
  const itemCount = await prisma.item.count();
  const dbSeedCheckMs = Number((performance.now() - startedAt).toFixed(2));

  if (itemCount > 0) {
    return {
      dbSeedCheckMs,
      dbSeedMs: 0,
    };
  }

  const seedRun = await runCommand('yarn', ['db:seed']);
  return {
    dbSeedCheckMs,
    dbSeedMs: seedRun.durationMs,
  };
}

async function main() {
  await ensurePerfDir();

  const buildRun = await runCommand('yarn', ['nx', 'run', 'api:build'], {
    env: {
      NODE_ENV: 'production',
    },
  });
  const migrateRun = await runCommand('yarn', [
    'prisma',
    'migrate',
    'deploy',
    '--schema=apps/api/prisma/schema.prisma',
  ]);
  const seedResult = await measureSeedCheck();

  const port = process.env.PERF_PROD_PORT ?? '3001';
  const server = await startCommandServer({
    command: 'node',
    args: ['dist/apps/api/main.js'],
    env: {
      NODE_ENV: 'production',
      PORT: port,
    },
    runtimeMode: 'production',
  });

  try {
    const summary = {
      generated_at: new Date().toISOString(),
      startup: {
        build_ms: buildRun.durationMs,
        db_migrate_ms: migrateRun.durationMs,
        db_seed_check_ms: seedResult.dbSeedCheckMs,
        db_seed_ms: seedResult.dbSeedMs,
        api_prod_ready_ms: server.wallReadyMs,
        api_bootstrap_ms:
          server.readyRecord.api_bootstrap_ms ?? server.readyRecord.api_dev_ready_ms ?? null,
        rss_mb_at_ready: server.readyRecord.rss_mb_at_ready ?? null,
        heap_mb_at_ready: server.readyRecord.heap_mb_at_ready ?? null,
        event_loop_lag_p95_ms: server.readyRecord.event_loop_lag_p95_ms ?? null,
        active_sse_streams: server.readyRecord.active_sse_streams ?? null,
        active_sse_subscribers: server.readyRecord.active_sse_subscribers ?? null,
        port: server.readyRecord.port ?? null,
      },
    };

    const stamp = timestampId();
    await writeJson(path.join(perfDir, `prod-startup-${stamp}.json`), summary);
    await writeJson(path.join(perfDir, 'latest-prod-startup.json'), summary);
    await writeJsonl(path.join(perfDir, `prod-startup-records-${stamp}.jsonl`), server.perfRecords);
    await writeJsonl(path.join(perfDir, 'latest-prod-startup-records.jsonl'), server.perfRecords);

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
    await stopApiServer(server);
  }
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

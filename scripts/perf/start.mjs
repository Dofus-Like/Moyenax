import path from 'node:path';
import {
  ensurePerfDir,
  perfDir,
  startApiServer,
  stopApiServer,
  timestampId,
  writeJson,
  writeJsonl,
} from './lib.mjs';

async function main() {
  await ensurePerfDir();

  const server = await startApiServer();
  try {
    const summary = {
      generated_at: new Date().toISOString(),
      startup: {
        api_dev_ready_ms: server.wallReadyMs,
        api_bootstrap_ms: server.readyRecord.api_dev_ready_ms ?? null,
        rss_mb_at_ready: server.readyRecord.rss_mb_at_ready ?? null,
        heap_mb_at_ready: server.readyRecord.heap_mb_at_ready ?? null,
        port: server.readyRecord.port ?? null,
      },
    };

    const stamp = timestampId();
    await writeJson(path.join(perfDir, `startup-${stamp}.json`), summary);
    await writeJson(path.join(perfDir, 'latest-startup.json'), summary);
    await writeJsonl(path.join(perfDir, `startup-records-${stamp}.jsonl`), server.perfRecords);
    await writeJsonl(path.join(perfDir, 'latest-startup-records.jsonl'), server.perfRecords);

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await stopApiServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

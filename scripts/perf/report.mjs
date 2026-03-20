import path from 'node:path';
import { perfDir, readJson } from './lib.mjs';

async function readOptional(fileName) {
  try {
    return await readJson(path.join(perfDir, fileName));
  } catch {
    return null;
  }
}

function printSection(title, rows) {
  console.log(`\n${title}`);
  for (const row of rows) {
    console.log(row);
  }
}

async function main() {
  const baseline = await readOptional('latest-baseline.json');
  const startup = await readOptional('latest-startup.json');

  if (!baseline && !startup) {
    throw new Error('No perf summary found in tmp/perf. Run yarn perf:api:start or yarn perf:api:baseline first.');
  }

  if (startup) {
    printSection('Startup', [
      `api_dev_ready_ms: ${startup.startup.api_dev_ready_ms}`,
      `api_bootstrap_ms: ${startup.startup.api_bootstrap_ms ?? 'n/a'}`,
      `rss_mb_at_ready: ${startup.startup.rss_mb_at_ready}`,
      `heap_mb_at_ready: ${startup.startup.heap_mb_at_ready}`,
    ]);
  }

  if (baseline) {
    printSection('Client p95', Object.entries(baseline.client).map(
      ([name, stats]) => `${name}: ${stats?.p95 ?? 'n/a'} ms`,
    ));

    printSection('Server overall', [
      `http_p95_ms: ${baseline.server.http_overall?.p95 ?? 'n/a'}`,
      `prisma_p95_ms: ${baseline.server.prisma_overall?.p95 ?? 'n/a'}`,
      `redis_p95_ms: ${baseline.server.redis_overall?.p95 ?? 'n/a'}`,
      `slow_log_count: ${baseline.server.slow_log_count}`,
    ]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

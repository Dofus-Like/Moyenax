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
  const prodStartup = await readOptional('latest-prod-startup.json');

  if (!baseline && !startup && !prodStartup) {
    throw new Error(
      'No perf summary found in tmp/perf. Run yarn perf:api:start, yarn perf:api:baseline or yarn perf:api:prod-start first.',
    );
  }

  if (startup) {
    printSection('Startup', [
      `api_dev_ready_ms: ${startup.startup.api_dev_ready_ms}`,
      `api_bootstrap_ms: ${startup.startup.api_bootstrap_ms ?? 'n/a'}`,
      `rss_mb_at_ready: ${startup.startup.rss_mb_at_ready}`,
      `heap_mb_at_ready: ${startup.startup.heap_mb_at_ready}`,
      `event_loop_lag_p95_ms: ${startup.startup.event_loop_lag_p95_ms ?? 'n/a'}`,
      `active_sse_streams: ${startup.startup.active_sse_streams ?? 'n/a'}`,
      `active_sse_subscribers: ${startup.startup.active_sse_subscribers ?? 'n/a'}`,
    ]);
  }

  if (prodStartup) {
    printSection('Prod Startup', [
      `build_ms: ${prodStartup.startup.build_ms ?? 'n/a'}`,
      `db_migrate_ms: ${prodStartup.startup.db_migrate_ms ?? 'n/a'}`,
      `db_seed_check_ms: ${prodStartup.startup.db_seed_check_ms ?? 'n/a'}`,
      `db_seed_ms: ${prodStartup.startup.db_seed_ms ?? 'n/a'}`,
      `api_prod_ready_ms: ${prodStartup.startup.api_prod_ready_ms ?? 'n/a'}`,
      `api_bootstrap_ms: ${prodStartup.startup.api_bootstrap_ms ?? 'n/a'}`,
      `rss_mb_at_ready: ${prodStartup.startup.rss_mb_at_ready ?? 'n/a'}`,
      `heap_mb_at_ready: ${prodStartup.startup.heap_mb_at_ready ?? 'n/a'}`,
    ]);
  }

  if (baseline) {
    printSection(
      'Client p95/p99',
      Object.entries(baseline.client).map(
        ([name, stats]) => `${name}: p95=${stats?.p95 ?? 'n/a'} ms p99=${stats?.p99 ?? 'n/a'} ms`,
      ),
    );

    printSection('Server overall', [
      `http_p95_ms: ${baseline.server.http_overall?.p95 ?? 'n/a'} | p99=${baseline.server.http_overall?.p99 ?? 'n/a'}`,
      `prisma_p95_ms: ${baseline.server.prisma_overall?.p95 ?? 'n/a'} | p99=${baseline.server.prisma_overall?.p99 ?? 'n/a'}`,
      `redis_p95_ms: ${baseline.server.redis_overall?.p95 ?? 'n/a'} | p99=${baseline.server.redis_overall?.p99 ?? 'n/a'}`,
      `event_loop_lag_p95_ms: ${baseline.server.event_loop_lag_overall?.p95 ?? 'n/a'} | p99=${baseline.server.event_loop_lag_overall?.p99 ?? 'n/a'}`,
      `active_sse_streams_max: ${baseline.server.active_sse_streams?.max ?? 'n/a'} | last=${baseline.server.active_sse_streams?.last ?? 'n/a'}`,
      `active_sse_subscribers_max: ${baseline.server.active_sse_subscribers?.max ?? 'n/a'} | last=${baseline.server.active_sse_subscribers?.last ?? 'n/a'}`,
      `combat_state_payload_bytes_p95: ${baseline.server.combat_state_payload_bytes?.p95 ?? 'n/a'} | p99=${baseline.server.combat_state_payload_bytes?.p99 ?? 'n/a'}`,
      `combat_sse_events_per_action_p95: ${baseline.server.combat_sse_events_per_action?.p95 ?? 'n/a'} | p99=${baseline.server.combat_sse_events_per_action?.p99 ?? 'n/a'}`,
      `sse_event_fanout_p95: ${baseline.server.sse_event_fanout?.p95 ?? 'n/a'} | p99=${baseline.server.sse_event_fanout?.p99 ?? 'n/a'}`,
      `slow_log_count: ${baseline.server.slow_log_count}`,
    ]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

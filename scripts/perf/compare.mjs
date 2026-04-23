import path from 'node:path';
import { readJson, repoRoot } from './lib.mjs';

function compareNumber(label, actual, budget, failures) {
  const passed = typeof actual === 'number' && actual <= budget;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}: actual=${actual} budget=${budget}`);
  if (!passed) {
    failures.push(label);
  }
}

async function main() {
  const summary = await readJson(path.join(repoRoot, 'tmp', 'perf', 'latest-baseline.json'));
  let prodStartup = null;
  try {
    prodStartup = await readJson(path.join(repoRoot, 'tmp', 'perf', 'latest-prod-startup.json'));
  } catch {
    prodStartup = null;
  }
  const budgets = await readJson(path.join(repoRoot, 'apps', 'api', 'perf-budgets.json'));
  const failures = [];

  compareNumber(
    'startup.api_dev_ready_ms',
    summary.startup.api_dev_ready_ms,
    budgets.startup.api_dev_ready_ms,
    failures,
  );
  compareNumber(
    'startup.rss_mb_at_ready',
    summary.startup.rss_mb_at_ready,
    budgets.startup.rss_mb_at_ready,
    failures,
  );
  compareNumber(
    'startup.heap_mb_at_ready',
    summary.startup.heap_mb_at_ready,
    budgets.startup.heap_mb_at_ready,
    failures,
  );
  compareNumber(
    'startup.event_loop_lag_p95_ms',
    summary.server.event_loop_lag_overall?.p95,
    budgets.startup.event_loop_lag_p95_ms,
    failures,
  );

  for (const [scenario, budget] of Object.entries(budgets.client)) {
    compareNumber(
      `client.${scenario}.p95_ms`,
      summary.client[scenario]?.p95,
      budget.p95_ms,
      failures,
    );
    compareNumber(
      `client.${scenario}.p99_ms`,
      summary.client[scenario]?.p99,
      budget.p99_ms,
      failures,
    );
  }

  compareNumber(
    'server.http_p95_ms',
    summary.server.http_overall?.p95,
    budgets.server.http_p95_ms,
    failures,
  );
  compareNumber(
    'server.http_p99_ms',
    summary.server.http_overall?.p99,
    budgets.server.http_p99_ms,
    failures,
  );
  compareNumber(
    'server.prisma_p95_ms',
    summary.server.prisma_overall?.p95,
    budgets.server.prisma_p95_ms,
    failures,
  );
  compareNumber(
    'server.prisma_p99_ms',
    summary.server.prisma_overall?.p99,
    budgets.server.prisma_p99_ms,
    failures,
  );
  compareNumber(
    'server.redis_p95_ms',
    summary.server.redis_overall?.p95,
    budgets.server.redis_p95_ms,
    failures,
  );
  compareNumber(
    'server.redis_p99_ms',
    summary.server.redis_overall?.p99,
    budgets.server.redis_p99_ms,
    failures,
  );
  compareNumber(
    'server.active_sse_streams_max',
    summary.server.active_sse_streams?.max,
    budgets.server.active_sse_streams_max,
    failures,
  );
  compareNumber(
    'server.combat_state_payload_bytes_p95',
    summary.server.combat_state_payload_bytes?.p95,
    budgets.server.combat_state_payload_bytes_p95,
    failures,
  );
  compareNumber(
    'server.combat_sse_events_per_action_p95',
    summary.server.combat_sse_events_per_action?.p95,
    budgets.server.combat_sse_events_per_action_p95,
    failures,
  );
  compareNumber(
    'server.sse_event_fanout_p95',
    summary.server.sse_event_fanout?.p95,
    budgets.server.sse_event_fanout_p95,
    failures,
  );
  compareNumber(
    'server.slow_log_count',
    summary.server.slow_log_count,
    budgets.server.slow_log_count,
    failures,
  );

  if (prodStartup) {
    compareNumber(
      'startup.api_prod_ready_ms',
      prodStartup.startup.api_prod_ready_ms,
      budgets.startup.api_prod_ready_ms,
      failures,
    );
    compareNumber(
      'startup.db_migrate_ms',
      prodStartup.startup.db_migrate_ms,
      budgets.startup.db_migrate_ms,
      failures,
    );
    compareNumber(
      'startup.db_seed_check_ms',
      prodStartup.startup.db_seed_check_ms,
      budgets.startup.db_seed_check_ms,
      failures,
    );
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

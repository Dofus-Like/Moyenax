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
  const budgets = await readJson(path.join(repoRoot, 'apps', 'api', 'perf-budgets.json'));
  const failures = [];

  compareNumber('startup.api_dev_ready_ms', summary.startup.api_dev_ready_ms, budgets.startup.api_dev_ready_ms, failures);
  compareNumber('startup.rss_mb_at_ready', summary.startup.rss_mb_at_ready, budgets.startup.rss_mb_at_ready, failures);
  compareNumber('startup.heap_mb_at_ready', summary.startup.heap_mb_at_ready, budgets.startup.heap_mb_at_ready, failures);

  for (const [scenario, budget] of Object.entries(budgets.client)) {
    compareNumber(`client.${scenario}.p95_ms`, summary.client[scenario]?.p95, budget.p95_ms, failures);
  }

  compareNumber('server.http_p95_ms', summary.server.http_overall?.p95, budgets.server.http_p95_ms, failures);
  compareNumber('server.prisma_p95_ms', summary.server.prisma_overall?.p95, budgets.server.prisma_p95_ms, failures);
  compareNumber('server.redis_p95_ms', summary.server.redis_overall?.p95, budgets.server.redis_p95_ms, failures);
  compareNumber('server.slow_log_count', summary.server.slow_log_count, budgets.server.slow_log_count, failures);

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Compares current test coverage against the committed baseline.
 * Exits with code 1 if any metric regresses.
 *
 * Usage:
 *   node scripts/ci/coverage-compare.mjs              # compare mode (CI)
 *   node scripts/ci/coverage-compare.mjs --update     # update baseline file
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

const BASELINE_PATH = resolve(root, 'coverage/baseline.json');
const API_SUMMARY = resolve(root, 'coverage/apps/api/coverage-summary.json');
const WEB_SUMMARY = resolve(root, 'coverage/apps/web/coverage-summary.json');

const METRICS = ['lines', 'statements', 'functions', 'branches'];

function readSummary(path, project) {
  if (!existsSync(path)) {
    console.error(`❌  Coverage summary not found for ${project}: ${path}`);
    console.error(`    Run: yarn test:coverage`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const total = raw.total ?? raw;
  return Object.fromEntries(METRICS.map((m) => [m, total[m]?.pct ?? 0]));
}

function formatPct(n) {
  return `${n.toFixed(2)}%`;
}

const isUpdate = process.argv.includes('--update');

const api = readSummary(API_SUMMARY, 'api');
const web = readSummary(WEB_SUMMARY, 'web');

if (isUpdate) {
  const baseline = {
    api,
    web,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log('✅  Coverage baseline updated:', BASELINE_PATH);
  for (const [project, metrics] of Object.entries({ api, web })) {
    console.log(`\n  ${project}:`);
    for (const m of METRICS) {
      console.log(`    ${m.padEnd(12)} ${formatPct(metrics[m])}`);
    }
  }
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.warn('⚠️   No baseline found. Run with --update to create one.');
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
let failed = false;

for (const [project, current] of Object.entries({ api, web })) {
  const base = baseline[project] ?? {};
  console.log(`\n  ${project} (baseline: ${baseline.updatedAt ?? 'unknown'}):`);
  for (const m of METRICS) {
    const cur = current[m] ?? 0;
    const ref = base[m] ?? 0;
    const diff = cur - ref;
    const sign = diff >= 0 ? '+' : '';
    const ok = diff >= 0;
    const icon = ok ? '✅' : '❌';
    console.log(
      `  ${icon}  ${m.padEnd(12)} ${formatPct(cur).padStart(8)}  (baseline ${formatPct(ref)}, ${sign}${formatPct(diff)})`,
    );
    if (!ok) failed = true;
  }
}

if (failed) {
  console.error('\n❌  Coverage regression detected. Fix tests or update baseline.\n');
  process.exit(1);
} else {
  console.log('\n✅  No coverage regression.\n');
}

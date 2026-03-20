import path from 'node:path';
import {
  aggregateByName,
  computeStats,
  defaultApiBaseUrl,
  ensurePerfDir,
  perfDir,
  sleep,
  startApiServer,
  stopApiServer,
  timedRequest,
  timestampId,
  writeJson,
  writeJsonl,
} from './lib.mjs';

const PERF_RUNS = Number.parseInt(process.env.PERF_RUNS ?? '5', 10);
const TEST_EMAIL = process.env.PERF_TEST_EMAIL ?? 'warrior@test.com';
const TEST_PASSWORD = process.env.PERF_TEST_PASSWORD ?? 'password123';

function isPerfRecordAfter(record, benchmarkStartedAt) {
  const timestamp = Date.parse(record.ts);
  return Number.isFinite(timestamp) && timestamp >= benchmarkStartedAt;
}

function buildServerSummary(records, benchmarkStartedAt) {
  const runtimeRecords = records.filter(
    (record) => record.scope !== 'bootstrap' && isPerfRecordAfter(record, benchmarkStartedAt),
  );

  const httpRecords = runtimeRecords.filter(
    (record) => record.scope === 'http' && typeof record.duration_ms === 'number',
  );
  const prismaRecords = runtimeRecords.filter(
    (record) => record.scope === 'prisma' && typeof record.duration_ms === 'number',
  );
  const redisRecords = runtimeRecords.filter(
    (record) => record.scope === 'redis' && typeof record.duration_ms === 'number',
  );
  const slowLogCount = runtimeRecords.filter((record) => record.slow === true).length;

  return {
    http_overall: computeStats(httpRecords.map((record) => record.duration_ms)),
    prisma_overall: computeStats(prismaRecords.map((record) => record.duration_ms)),
    redis_overall: computeStats(redisRecords.map((record) => record.duration_ms)),
    slow_log_count: slowLogCount,
    by_http: aggregateByName(httpRecords),
    by_prisma: aggregateByName(prismaRecords),
    by_redis: aggregateByName(redisRecords),
  };
}

async function login(baseUrl) {
  const loginResult = await timedRequest(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  if (!loginResult.response.ok) {
    throw new Error(`Login failed with status ${loginResult.response.status}: ${loginResult.bodyText}`);
  }

  const payload = JSON.parse(loginResult.bodyText);
  if (typeof payload.accessToken !== 'string') {
    throw new Error('Login response does not contain an access token.');
  }

  return payload.accessToken;
}

async function measureScenario(baseUrl, scenario) {
  const durations = [];

  for (let runIndex = 0; runIndex < PERF_RUNS; runIndex += 1) {
    const result = await timedRequest(`${baseUrl}${scenario.path}`, scenario.request());
    if (!result.response.ok) {
      throw new Error(`${scenario.name} failed with status ${result.response.status}: ${result.bodyText}`);
    }

    durations.push(result.durationMs);
  }

  return computeStats(durations);
}

async function main() {
  await ensurePerfDir();

  const server = await startApiServer();
  try {
    const token = await login(defaultApiBaseUrl);
    const benchmarkStartedAt = Date.now();
    const authHeaders = {
      authorization: `Bearer ${token}`,
    };

    const scenarios = [
      {
        name: 'POST /api/v1/auth/login',
        path: '/auth/login',
        request: () => ({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
          }),
        }),
      },
      {
        name: 'GET /api/v1/auth/me',
        path: '/auth/me',
        request: () => ({
          headers: authHeaders,
        }),
      },
      {
        name: 'GET /api/v1/player/stats',
        path: '/player/stats',
        request: () => ({
          headers: authHeaders,
        }),
      },
      {
        name: 'GET /api/v1/inventory',
        path: '/inventory',
        request: () => ({
          headers: authHeaders,
        }),
      },
      {
        name: 'GET /api/v1/equipment',
        path: '/equipment',
        request: () => ({
          headers: authHeaders,
        }),
      },
      {
        name: 'GET /api/v1/combat/rooms',
        path: '/combat/rooms',
        request: () => ({
          headers: authHeaders,
        }),
      },
      {
        name: 'GET /api/v1/map',
        path: '/map',
        request: () => ({}),
      },
    ];

    const clientSummary = {};
    for (const scenario of scenarios) {
      clientSummary[scenario.name] = await measureScenario(defaultApiBaseUrl, scenario);
    }

    await sleep(300);

    const summary = {
      generated_at: new Date().toISOString(),
      runs: PERF_RUNS,
      startup: {
        api_dev_ready_ms: server.wallReadyMs,
        api_bootstrap_ms: server.readyRecord.api_dev_ready_ms ?? null,
        rss_mb_at_ready: server.readyRecord.rss_mb_at_ready ?? null,
        heap_mb_at_ready: server.readyRecord.heap_mb_at_ready ?? null,
      },
      client: clientSummary,
      server: buildServerSummary(server.perfRecords, benchmarkStartedAt),
    };

    const stamp = timestampId();
    await writeJson(path.join(perfDir, `baseline-${stamp}.json`), summary);
    await writeJson(path.join(perfDir, 'latest-baseline.json'), summary);
    await writeJsonl(path.join(perfDir, `baseline-records-${stamp}.jsonl`), server.perfRecords);
    await writeJsonl(path.join(perfDir, 'latest-baseline-records.jsonl'), server.perfRecords);

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await stopApiServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

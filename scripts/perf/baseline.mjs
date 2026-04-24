import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import {
  aggregateByName,
  aggregateMetricByName,
  buildGaugeSummary,
  computeStats,
  defaultApiBaseUrl,
  ensurePerfDir,
  openSseConnection,
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
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

function isPerfRecordAfter(record, benchmarkStartedAt) {
  const timestamp = Date.parse(record.ts);
  return Number.isFinite(timestamp) && timestamp >= benchmarkStartedAt;
}

function buildServerSummary(records, benchmarkStartedAt) {
  const ignoredHttpOverallRoutes = new Set(['GET /api/v1/combat/session/:id/events']);
  const runtimeRecords = records.filter(
    (record) => record.scope !== 'bootstrap' && isPerfRecordAfter(record, benchmarkStartedAt),
  );

  const httpAllRecords = runtimeRecords.filter(
    (record) => record.scope === 'http' && typeof record.duration_ms === 'number',
  );
  const httpRecords = httpAllRecords.filter((record) => !ignoredHttpOverallRoutes.has(record.name));
  const prismaRecords = runtimeRecords.filter(
    (record) => record.scope === 'prisma' && typeof record.duration_ms === 'number',
  );
  const redisRecords = runtimeRecords.filter(
    (record) => record.scope === 'redis' && typeof record.duration_ms === 'number',
  );
  const eventLoopRecords = runtimeRecords.filter(
    (record) => record.scope === 'runtime' && record.name === 'event_loop.lag',
  );
  const sseStreamRecords = runtimeRecords.filter(
    (record) => record.scope === 'sse' && record.name === 'streams.active',
  );
  const sseSubscriberRecords = runtimeRecords.filter(
    (record) => record.scope === 'sse' && record.name === 'subscribers.active',
  );
  const sseFanoutRecords = runtimeRecords.filter(
    (record) => record.scope === 'sse' && record.name === 'event.fanout',
  );
  const combatActionSseRecords = runtimeRecords.filter(
    (record) => record.scope === 'combat' && record.name === 'action.sse_events',
  );
  const combatPayloadRecords = runtimeRecords.filter(
    (record) => record.scope === 'combat_state' && record.name === 'payload.bytes',
  );
  const slowLogCount = runtimeRecords.filter(
    (record) =>
      record.slow === true &&
      !(record.scope === 'http' && ignoredHttpOverallRoutes.has(record.name)),
  ).length;

  return {
    http_overall: computeStats(httpRecords.map((record) => record.duration_ms)),
    prisma_overall: computeStats(prismaRecords.map((record) => record.duration_ms)),
    redis_overall: computeStats(redisRecords.map((record) => record.duration_ms)),
    event_loop_lag_overall: computeStats(eventLoopRecords.map((record) => record.metric_value)),
    active_sse_streams: buildGaugeSummary(sseStreamRecords),
    active_sse_subscribers: buildGaugeSummary(sseSubscriberRecords),
    sse_event_fanout: computeStats(sseFanoutRecords.map((record) => record.metric_value)),
    combat_sse_events_per_action: computeStats(
      combatActionSseRecords.map((record) => record.metric_value),
    ),
    combat_state_payload_bytes: computeStats(
      combatPayloadRecords.map((record) => record.metric_value),
    ),
    slow_log_count: slowLogCount,
    by_http: aggregateByName(httpAllRecords),
    by_prisma: aggregateByName(prismaRecords),
    by_redis: aggregateByName(redisRecords),
    by_metric: aggregateMetricByName([
      ...eventLoopRecords,
      ...sseStreamRecords,
      ...sseSubscriberRecords,
      ...sseFanoutRecords,
      ...combatActionSseRecords,
      ...combatPayloadRecords,
    ]),
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
    throw new Error(
      `Login failed with status ${loginResult.response.status}: ${loginResult.bodyText}`,
    );
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
      throw new Error(
        `${scenario.name} failed with status ${result.response.status}: ${result.bodyText}`,
      );
    }

    durations.push(result.durationMs);
  }

  return computeStats(durations);
}

async function exerciseSseLifecycle(baseUrl, authHeaders) {
  const sessionId = `perf-sse-${timestampId()}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const connection = await openSseConnection(
      `${baseUrl}/combat/session/${sessionId}/events`,
      authHeaders,
    );
    await sleep(150);
    await connection.close();
    await sleep(150);
  }
}

async function createCombatSession(baseUrl, authHeaders) {
  const result = await timedRequest(`${baseUrl}/combat/test`, {
    method: 'POST',
    headers: authHeaders,
  });

  if (!result.response.ok) {
    throw new Error(`Combat test failed with status ${result.response.status}: ${result.bodyText}`);
  }

  return JSON.parse(result.bodyText);
}

async function exerciseCombatFlow(baseUrl, authHeaders, initialState) {
  const connection = await openSseConnection(
    `${baseUrl}/combat/session/${initialState.sessionId}/events`,
    authHeaders,
  );

  try {
    await sleep(150);

    let state = initialState;
    for (let runIndex = 0; runIndex < 3; runIndex += 1) {
      const result = await timedRequest(`${baseUrl}/combat/action/${state.sessionId}/force`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          asPlayerId: state.currentTurnPlayerId,
          action: {
            type: 'END_TURN',
          },
        }),
      });

      if (!result.response.ok) {
        throw new Error(
          `Combat action failed with status ${result.response.status}: ${result.bodyText}`,
        );
      }

      state = JSON.parse(result.bodyText);
    }

    await sleep(250);
    return state;
  } finally {
    await connection.close();
  }
}

async function cleanupCombatArtifacts(sessionId) {
  if (!sessionId) {
    return;
  }

  await prisma.combatTurn.deleteMany({
    where: {
      sessionId,
    },
  });
  await prisma.combatSession.deleteMany({
    where: {
      id: sessionId,
    },
  });
  await redis.del(`combat:${sessionId}`);
}

async function main() {
  await ensurePerfDir();

  const server = await startApiServer();
  let combatSessionId = null;

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

    await exerciseSseLifecycle(defaultApiBaseUrl, authHeaders);

    const clientSummary = {};
    for (const scenario of scenarios) {
      clientSummary[scenario.name] = await measureScenario(defaultApiBaseUrl, scenario);
    }

    const combatState = await createCombatSession(defaultApiBaseUrl, authHeaders);
    combatSessionId = combatState.sessionId;
    await exerciseCombatFlow(defaultApiBaseUrl, authHeaders, combatState);

    await sleep(300);

    const summary = {
      generated_at: new Date().toISOString(),
      runs: PERF_RUNS,
      startup: {
        api_dev_ready_ms: server.wallReadyMs,
        api_bootstrap_ms:
          server.readyRecord.api_bootstrap_ms ?? server.readyRecord.api_dev_ready_ms ?? null,
        rss_mb_at_ready: server.readyRecord.rss_mb_at_ready ?? null,
        heap_mb_at_ready: server.readyRecord.heap_mb_at_ready ?? null,
        event_loop_lag_p95_ms: server.readyRecord.event_loop_lag_p95_ms ?? null,
        active_sse_streams: server.readyRecord.active_sse_streams ?? null,
        active_sse_subscribers: server.readyRecord.active_sse_subscribers ?? null,
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
    await cleanupCombatArtifacts(combatSessionId);
    await prisma.$disconnect();
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
    await stopApiServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(scriptDir, '..', '..');
export const composeFiles = [
  resolve(repoRoot, 'docker-compose.portainer.yml'),
  resolve(repoRoot, 'docker-compose.ci-local.override.yml'),
];

export const composeProjectName = 'dofus-like-ci-local';
export const apiImage = process.env.CI_LOCAL_API_IMAGE ?? 'dofus-like-api:ci-local';
export const webImage = process.env.CI_LOCAL_WEB_IMAGE ?? 'dofus-like-web:ci-local';
export const apiSetupContainerName = 'dofus-like-api-setup-ci-local';
export const apiContainerName = 'dofus-like-api-ci-local';
export const webContainerName = 'dofus-like-web-ci-local';
export const postgresContainerName = 'dofus-like-postgres-ci-local';
export const redisContainerName = 'dofus-like-redis-ci-local';
export const apiPort = process.env.CI_LOCAL_API_PORT ?? '13000';
export const webPort = process.env.CI_LOCAL_WEB_PORT ?? '18080';
export const dirtySecurityFixturePath = resolve(
  repoRoot,
  'scripts',
  'ci',
  'fixtures',
  'dirty-security-migration-state.sql',
);

export const ciEnv = {
  ...process.env,
  COMPOSE_PROJECT_NAME: composeProjectName,
  IMAGE_TAG: 'ci-local',
  CI_LOCAL_API_IMAGE: apiImage,
  CI_LOCAL_WEB_IMAGE: webImage,
  CI_LOCAL_API_PORT: apiPort,
  CI_LOCAL_WEB_PORT: webPort,
  CI_LOCAL_POSTGRES_PORT: process.env.CI_LOCAL_POSTGRES_PORT ?? '15432',
  CI_LOCAL_REDIS_PORT: process.env.CI_LOCAL_REDIS_PORT ?? '16379',
  JWT_SECRET: process.env.JWT_SECRET ?? 'ci-local-jwt-secret-32-chars-minimum',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'ci-local-postgres-password',
};

export function logStep(message, prefix = 'prod-local') {
  console.log(`\n[${prefix}] ${message}`);
}

export function run(command, args, options = {}) {
  const {
    allowFailure = false,
    capture = false,
    env = ciEnv,
    input,
  } = options;

  const stdio = capture
    ? [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe']
    : 'inherit';

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio,
    encoding: 'utf8',
    input,
  });

  if (result.error) {
    throw result.error;
  }

  if (!allowFailure && result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    throw new Error(stderr || stdout || `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }

  return result;
}

export function runCompose(args, options = {}) {
  const composeArgs = ['compose'];
  for (const file of composeFiles) {
    composeArgs.push('-f', file);
  }
  composeArgs.push(...args);
  return run('docker', composeArgs, options);
}

export function cleanup({ prefix = 'prod-local', env = ciEnv, volumes = true } = {}) {
  logStep('Cleaning up local CI stack', prefix);
  const downArgs = ['down'];
  if (volumes) {
    downArgs.push('-v');
  }
  downArgs.push('--remove-orphans');
  runCompose(downArgs, { allowFailure: true, env });
}

export function dumpLogs({ prefix = 'prod-local', env = ciEnv } = {}) {
  logStep('Collecting service logs', prefix);
  runCompose(['logs', '--no-color', 'postgres', 'redis', 'api-setup', 'api', 'web'], {
    allowFailure: true,
    env,
  });
}

export async function waitForApiSetup(timeoutMs, { env = ciEnv } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const inspection = run(
      'docker',
      ['inspect', '--format', '{{.State.Status}}|{{.State.ExitCode}}', apiSetupContainerName],
      { allowFailure: true, capture: true, env },
    );

    if (inspection.status === 0) {
      const [status, exitCode] = inspection.stdout.trim().split('|');
      if (status === 'exited' && exitCode === '0') {
        return;
      }

      if (status === 'exited') {
        throw new Error(`api-setup exited with code ${exitCode}`);
      }
    }

    await sleep(2000);
  }

  throw new Error('Timed out waiting for api-setup to finish');
}

export async function waitForApiHealthy(timeoutMs, { env = ciEnv } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const inspection = run(
      'docker',
      ['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}|{{.State.Status}}', apiContainerName],
      { allowFailure: true, capture: true, env },
    );

    if (inspection.status === 0) {
      const [healthStatus, stateStatus] = inspection.stdout.trim().split('|');
      if (healthStatus === 'healthy') {
        return;
      }

      if (healthStatus === 'unhealthy' || stateStatus === 'exited') {
        throw new Error(`api container is ${healthStatus} (${stateStatus})`);
      }
    }

    await sleep(3000);
  }

  throw new Error('Timed out waiting for API healthcheck');
}

export async function waitForWeb(timeoutMs, { env = ciEnv } = {}) {
  const deadline = Date.now() + timeoutMs;
  const url = getWebUrl(env);

  while (Date.now() < deadline) {
    const state = run(
      'docker',
      ['inspect', '--format', '{{.State.Status}}', webContainerName],
      { allowFailure: true, capture: true, env },
    );

    if (state.status === 0 && state.stdout.trim() === 'exited') {
      throw new Error('web container exited before becoming reachable');
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore
    }

    await sleep(2000);
  }

  throw new Error('Timed out waiting for web container');
}

export async function bootApplicationStack({ prefix = 'prod-local', env = ciEnv } = {}) {
  logStep('Starting infra and api-setup', prefix);
  runCompose(['up', '-d', 'postgres', 'redis', 'api-setup'], { env });

  logStep('Waiting for api-setup completion', prefix);
  await waitForApiSetup(180000, { env });

  logStep('Starting API and web', prefix);
  runCompose(['up', '-d', 'api', 'web'], { env });

  logStep('Waiting for API healthcheck', prefix);
  await waitForApiHealthy(180000, { env });

  logStep('Waiting for web availability', prefix);
  await waitForWeb(120000, { env });
}

export function buildImages({ prefix = 'prod-local', env = ciEnv } = {}) {
  logStep('Checking Docker availability', prefix);
  run('docker', ['version', '--format', '{{.Server.Version}}'], { env });
  run('docker', ['compose', 'version'], { env });

  logStep('Building API image', prefix);
  run('docker', ['build', '--progress', 'plain', '-f', 'apps/api/Dockerfile', '-t', apiImage, '.'], { env });

  logStep('Building Web image', prefix);
  run(
    'docker',
    ['build', '--progress', 'plain', '-f', 'apps/web/Dockerfile', '--build-arg', 'VITE_API_URL=/api/v1', '-t', webImage, '.'],
    { env },
  );
}

export function runPsql(sql, { capture = false, env = ciEnv } = {}) {
  return run(
    'docker',
    ['exec', '-i', postgresContainerName, 'psql', '-U', 'game_user', '-d', 'game_db', '-v', 'ON_ERROR_STOP=1'],
    { capture, env, input: sql },
  );
}

export function runSqlFile(filePath, { env = ciEnv } = {}) {
  runPsql(readFileSync(filePath, 'utf8'), { env });
}

export function querySingleValue(sql, { env = ciEnv } = {}) {
  const result = run(
    'docker',
    ['exec', '-i', postgresContainerName, 'psql', '-U', 'game_user', '-d', 'game_db', '-v', 'ON_ERROR_STOP=1', '-t', '-A'],
    { capture: true, env, input: `${sql.trim()}\n` },
  );

  return result.stdout.trim();
}

export function assertSecurityRecoveryState({ env = ciEnv } = {}) {
  const indexCount = querySingleValue(`
    SELECT COUNT(*)
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'GameSession_player1Id_open_key',
        'GameSession_player2Id_open_key',
        'CombatSession_player1Id_open_public_key',
        'CombatSession_player2Id_open_public_key'
      );
  `, { env });

  if (indexCount !== '4') {
    throw new Error(`expected 4 security indexes after recovery, got ${indexCount}`);
  }

  const duplicateCount = querySingleValue(`
    WITH game_player1_dupes AS (
      SELECT COUNT(*) AS duplicate_count
      FROM (
        SELECT "player1Id"
        FROM "GameSession"
        WHERE status IN ('WAITING', 'ACTIVE')
        GROUP BY "player1Id"
        HAVING COUNT(*) > 1
      ) AS duplicates
    ),
    game_player2_dupes AS (
      SELECT COUNT(*) AS duplicate_count
      FROM (
        SELECT "player2Id"
        FROM "GameSession"
        WHERE status IN ('WAITING', 'ACTIVE')
          AND "player2Id" IS NOT NULL
        GROUP BY "player2Id"
        HAVING COUNT(*) > 1
      ) AS duplicates
    ),
    combat_player1_dupes AS (
      SELECT COUNT(*) AS duplicate_count
      FROM (
        SELECT "player1Id"
        FROM "CombatSession"
        WHERE status IN ('WAITING', 'ACTIVE')
          AND "gameSessionId" IS NULL
        GROUP BY "player1Id"
        HAVING COUNT(*) > 1
      ) AS duplicates
    ),
    combat_player2_dupes AS (
      SELECT COUNT(*) AS duplicate_count
      FROM (
        SELECT "player2Id"
        FROM "CombatSession"
        WHERE status IN ('WAITING', 'ACTIVE')
          AND "gameSessionId" IS NULL
          AND "player2Id" IS NOT NULL
        GROUP BY "player2Id"
        HAVING COUNT(*) > 1
      ) AS duplicates
    )
    SELECT
      (
        SELECT duplicate_count FROM game_player1_dupes
      ) + (
        SELECT duplicate_count FROM game_player2_dupes
      ) + (
        SELECT duplicate_count FROM combat_player1_dupes
      ) + (
        SELECT duplicate_count FROM combat_player2_dupes
      );
  `, { env });

  if (duplicateCount !== '0') {
    throw new Error(`expected duplicate open sessions to be repaired, got ${duplicateCount} remaining duplicate groups`);
  }
}

export async function fetchJson(path, { baseUrl = getApiBaseUrl(), body, method = 'GET', token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data === 'string'
          ? data
          : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function login(email, password, { baseUrl = getApiBaseUrl() } = {}) {
  const response = await fetchJson('/auth/login', {
    baseUrl,
    body: { email, password },
    method: 'POST',
  });

  return response.accessToken;
}

export function getApiUrl(env = ciEnv) {
  return `http://127.0.0.1:${env.CI_LOCAL_API_PORT ?? apiPort}`;
}

export function getApiBaseUrl(env = ciEnv) {
  return `${getApiUrl(env)}/api/v1`;
}

export function getWebUrl(env = ciEnv) {
  return `http://127.0.0.1:${env.CI_LOCAL_WEB_PORT ?? webPort}`;
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const portainerUrl = requiredEnv('PORTAINER_URL');
const portainerApiToken = requiredEnv('PORTAINER_API_TOKEN');
const portainerEndpointId = requiredEnv('PORTAINER_ENDPOINT_ID');
const stackName = requiredEnv('STACK_NAME');
const apiImage = requiredEnv('API_IMAGE');
const webImage = requiredEnv('WEB_IMAGE');
const imageTag = requiredEnv('IMAGE_TAG');
const expectedBuildSha = envOrDefault('EXPECTED_BUILD_SHA', imageTag);
const jwtSecret = requiredEnv('JWT_SECRET');
const postgresPassword = requiredEnv('POSTGRES_PASSWORD');
const stackContainerPrefix = requiredEnv('STACK_CONTAINER_PREFIX');
const traefikRouterPrefix = envOrDefault('TRAEFIK_ROUTER_PREFIX', stackContainerPrefix);
const apiHost = requiredEnv('API_HOST');
const webHost = requiredEnv('WEB_HOST');
const appNetworkName = requiredEnv('APP_NETWORK_NAME');
const frontendUrl = requiredEnv('FRONTEND_URL');
const composeFile = resolve(envOrDefault('PORTAINER_COMPOSE_FILE', 'docker-compose.portainer.yml'));
const smokeApiUrl = requiredEnv('SMOKE_API_URL');
const smokeWebUrl = requiredEnv('SMOKE_WEB_URL');
const jwtExpiresIn = envOrDefault('JWT_EXPIRES_IN', '7d');
const maxDeployAttempts = Number(envOrDefault('MAX_DEPLOY_ATTEMPTS', '4'));
const deployRetryDelayMs = Number(envOrDefault('DEPLOY_RETRY_DELAY_MS', '15000'));

// Version-match polling: waits until /api/v1/version and /version.txt both report the
// expected SHA. This is what makes the deploy actually reliable — previously the smoke
// check passed as soon as the OLD containers responded, which gave false greens.
const versionCheckTimeoutMs = Number(envOrDefault('VERSION_CHECK_TIMEOUT_MS', '600000'));
const versionCheckIntervalMs = Number(envOrDefault('VERSION_CHECK_INTERVAL_MS', '5000'));

// Functional smoke (health + web root). Only runs after the version match succeeds,
// so by this point we know we're hitting the new containers.
const smokeTimeoutMs = Number(envOrDefault('SMOKE_TIMEOUT_MS', '120000'));
const smokeIntervalMs = Number(envOrDefault('SMOKE_INTERVAL_MS', '5000'));

const rollbackVersionCheckTimeoutMs = Number(envOrDefault('ROLLBACK_VERSION_CHECK_TIMEOUT_MS', '300000'));
const rollbackSmokeTimeoutMs = Number(envOrDefault('ROLLBACK_SMOKE_TIMEOUT_MS', '180000'));
const rollbackOnFailure = envOrDefault('ROLLBACK_ON_FAILURE', 'false') === 'true';
const skipTlsVerify = envOrDefault('PORTAINER_INSECURE', 'true') === 'true';

if (skipTlsVerify) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const apiVersionUrl = deriveApiVersionUrl(smokeApiUrl);
const webVersionUrl = deriveWebVersionUrl(smokeWebUrl);

async function main() {
  logBanner('Deployment starting', {
    stack: stackName,
    expectedSha: expectedBuildSha,
    apiImage: `${apiImage}:${imageTag}`,
    webImage: `${webImage}:${imageTag}`,
  });

  const composeContent = readFileSync(composeFile, 'utf8');
  const desiredEnv = buildStackEnv();
  const stack = await getStackByName(stackName);
  const rollbackSnapshot = rollbackOnFailure && stack ? await createRollbackSnapshot(stack) : null;

  if (rollbackSnapshot) {
    console.log(`Rollback snapshot captured for stack '${stackName}'.`);
  }

  try {
    await deployStack({ stack, composeContent, desiredEnv });

    // Critical: wait for the NEW containers to actually be serving traffic
    // before we declare success. This is what catches silent redeploy failures
    // (migration crashed, container OOM, wrong env var, etc.).
    await verifyBuildSha({
      expectedSha: expectedBuildSha,
      timeoutMs: versionCheckTimeoutMs,
    });

    await runSmokeChecks(smokeTimeoutMs);

    logBanner('Deployment succeeded', {
      stack: stackName,
      sha: expectedBuildSha,
      apiUrl: smokeApiUrl,
      webUrl: smokeWebUrl,
    });
  } catch (error) {
    const message = toMessage(error);
    console.error(`::error::Deployment failed for stack '${stackName}': ${message}`);

    if (rollbackOnFailure && rollbackSnapshot) {
      console.log(`::warning::Attempting rollback on stack '${stackName}'...`);

      try {
        await updateStack(getStackId(stack), rollbackSnapshot);
        // On rollback we don't know the SHA that was running before, so we only
        // run the functional smoke — we know it's a previously-live config.
        await runSmokeChecks(rollbackSmokeTimeoutMs);
        console.log(`Rollback completed successfully for stack '${stackName}'.`);
      } catch (rollbackError) {
        console.error(`::error::Rollback failed: ${toMessage(rollbackError)}`);
      }
    }

    process.exitCode = 1;
  }
}

async function deployStack({ stack, composeContent, desiredEnv }) {
  const payload = {
    stackFileContent: composeContent,
    env: desiredEnv,
    pullImage: true,
    repullImageAndRedeploy: true,
    prune: false,
  };

  if (!stack) {
    console.log(`Creating stack '${stackName}'...`);
    await createStack(stackName, composeContent, desiredEnv);
    return;
  }

  let lastError;

  for (let attempt = 1; attempt <= maxDeployAttempts; attempt += 1) {
    try {
      console.log(`Updating stack '${stackName}' (attempt ${attempt}/${maxDeployAttempts})...`);
      await updateStack(getStackId(stack), payload);
      console.log(`Portainer accepted stack update for '${stackName}'.`);
      return;
    } catch (error) {
      lastError = error;

      if (attempt === maxDeployAttempts || !shouldRetry(error)) {
        throw error;
      }

      console.log(`::warning::Portainer update failed (retryable): ${toMessage(error)}`);
      console.log(`Waiting ${deployRetryDelayMs}ms before retrying...`);
      await sleep(deployRetryDelayMs);
    }
  }

  throw lastError;
}

async function createStack(name, stackFileContent, env) {
  return portainerRequest(
    'POST',
    `/api/stacks/create/standalone/string?endpointId=${encodeURIComponent(portainerEndpointId)}`,
    {
      name,
      stackFileContent,
      env,
    },
  );
}

async function updateStack(stackId, payload) {
  return portainerRequest(
    'PUT',
    `/api/stacks/${stackId}?endpointId=${encodeURIComponent(portainerEndpointId)}`,
    payload,
  );
}

async function getStackByName(name) {
  const stacks = await portainerRequest('GET', '/api/stacks');
  if (!Array.isArray(stacks)) {
    throw new Error('Unexpected Portainer response while listing stacks.');
  }
  return stacks.find((stack) => getStackName(stack) === name) ?? null;
}

async function createRollbackSnapshot(stack) {
  const stackId = getStackId(stack);
  const fileResponse = await portainerRequest('GET', `/api/stacks/${stackId}/file`);
  const stackFileContent = fileResponse?.StackFileContent ?? fileResponse?.stackFileContent;
  const env = getStackEnv(stack);

  if (typeof stackFileContent !== 'string') {
    throw new Error(`Unable to read current Portainer stack file for stack '${stackName}'.`);
  }

  if (!Array.isArray(env)) {
    throw new Error(`Unable to read current Portainer environment variables for stack '${stackName}'.`);
  }

  return {
    stackFileContent,
    env,
    pullImage: true,
    repullImageAndRedeploy: true,
    prune: false,
  };
}

async function verifyBuildSha({ expectedSha, timeoutMs }) {
  console.log(`Waiting for live containers to report SHA ${expectedSha} ...`);
  console.log(`  API  : ${apiVersionUrl}`);
  console.log(`  Web  : ${webVersionUrl}`);

  const deadline = Date.now() + timeoutMs;
  const nextLogAt = { api: 0, web: 0 };
  let apiMatched = false;
  let webMatched = false;
  let lastApiSha = null;
  let lastWebSha = null;
  let lastApiError = null;
  let lastWebError = null;

  while (Date.now() < deadline) {
    if (!apiMatched) {
      try {
        const sha = await fetchApiVersion();
        lastApiError = null;
        if (sha && sha === expectedSha) {
          console.log(`API is live on SHA ${expectedSha}.`);
          apiMatched = true;
        } else if (sha !== lastApiSha || Date.now() >= nextLogAt.api) {
          console.log(`  API currently reports sha=${sha ?? 'unknown'} (want ${expectedSha})`);
          lastApiSha = sha;
          nextLogAt.api = Date.now() + 30_000;
        }
      } catch (error) {
        lastApiError = error;
        if (Date.now() >= nextLogAt.api) {
          console.log(`  API version probe error: ${toMessage(error)}`);
          nextLogAt.api = Date.now() + 30_000;
        }
      }
    }

    if (!webMatched) {
      try {
        const sha = await fetchWebVersion();
        lastWebError = null;
        if (sha && sha === expectedSha) {
          console.log(`Web is live on SHA ${expectedSha}.`);
          webMatched = true;
        } else if (sha !== lastWebSha || Date.now() >= nextLogAt.web) {
          console.log(`  Web currently reports sha=${sha ?? 'unknown'} (want ${expectedSha})`);
          lastWebSha = sha;
          nextLogAt.web = Date.now() + 30_000;
        }
      } catch (error) {
        lastWebError = error;
        if (Date.now() >= nextLogAt.web) {
          console.log(`  Web version probe error: ${toMessage(error)}`);
          nextLogAt.web = Date.now() + 30_000;
        }
      }
    }

    if (apiMatched && webMatched) {
      return;
    }

    await sleep(versionCheckIntervalMs);
  }

  const parts = [];
  if (!apiMatched) {
    parts.push(
      `API still on sha=${lastApiSha ?? 'unknown'} (want ${expectedSha})` +
        (lastApiError ? ` — last error: ${toMessage(lastApiError)}` : ''),
    );
  }
  if (!webMatched) {
    parts.push(
      `Web still on sha=${lastWebSha ?? 'unknown'} (want ${expectedSha})` +
        (lastWebError ? ` — last error: ${toMessage(lastWebError)}` : ''),
    );
  }
  throw new Error(`SHA verification timed out. ${parts.join(' | ')}`);
}

async function fetchApiVersion() {
  const response = await fetch(apiVersionUrl, { redirect: 'follow', cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`API version endpoint returned HTTP ${response.status}`);
  }
  const payload = await response.json().catch(() => null);
  return typeof payload?.sha === 'string' ? payload.sha : null;
}

async function fetchWebVersion() {
  const response = await fetch(webVersionUrl, { redirect: 'follow', cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Web version endpoint returned HTTP ${response.status}`);
  }
  const raw = (await response.text()).trim();
  return raw.length > 0 ? raw : null;
}

async function runSmokeChecks(timeoutMs) {
  await waitForHttpCheck({
    label: 'API health',
    timeoutMs,
    url: smokeApiUrl,
    validate: async (response) => {
      const payload = await readResponsePayload(response);
      if (!response.ok || payload?.status !== 'ok') {
        throw new Error(`Unexpected API health response: ${JSON.stringify(payload)}`);
      }
    },
  });

  await waitForHttpCheck({
    label: 'Web root',
    timeoutMs,
    url: smokeWebUrl,
    validate: async (response) => {
      if (!response.ok) {
        throw new Error(`Unexpected web status: ${response.status}`);
      }
    },
  });
}

async function waitForHttpCheck({ label, timeoutMs, url, validate }) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
      await validate(response);
      console.log(`${label} check passed on ${url}`);
      return;
    } catch (error) {
      lastError = error;
      await sleep(smokeIntervalMs);
    }
  }

  throw new Error(`${label} check timed out on ${url}: ${toMessage(lastError)}`);
}

async function portainerRequest(method, path, payload) {
  const response = await fetch(new URL(path, normalizeBaseUrl(portainerUrl)), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': portainerApiToken,
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  const data = await readResponsePayload(response);

  if (!response.ok) {
    const error = new Error(extractErrorMessage(data, response.status));
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

function buildStackEnv() {
  return [
    { name: 'API_IMAGE', value: apiImage },
    { name: 'WEB_IMAGE', value: webImage },
    { name: 'IMAGE_TAG', value: imageTag },
    { name: 'JWT_SECRET', value: jwtSecret },
    { name: 'JWT_EXPIRES_IN', value: jwtExpiresIn },
    { name: 'POSTGRES_PASSWORD', value: postgresPassword },
    { name: 'STACK_CONTAINER_PREFIX', value: stackContainerPrefix },
    { name: 'TRAEFIK_ROUTER_PREFIX', value: traefikRouterPrefix },
    { name: 'API_HOST', value: apiHost },
    { name: 'WEB_HOST', value: webHost },
    { name: 'APP_NETWORK_NAME', value: appNetworkName },
    { name: 'FRONTEND_URL', value: frontendUrl },
  ];
}

function shouldRetry(error) {
  const status = typeof error?.status === 'number' ? error.status : 0;
  const content = JSON.stringify(error?.details ?? error?.message ?? '');

  return status >= 500 || /manifest unknown|failed to pull images of the stack/i.test(content);
}

function getStackId(stack) {
  return stack?.Id ?? stack?.id;
}

function getStackName(stack) {
  return stack?.Name ?? stack?.name;
}

function getStackEnv(stack) {
  return stack?.Env ?? stack?.env ?? null;
}

async function readResponsePayload(response) {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function extractErrorMessage(data, status) {
  if (typeof data === 'string') {
    return data;
  }

  if (typeof data?.details === 'string') {
    return data.details;
  }

  if (typeof data?.message === 'string') {
    return data.message;
  }

  return `Portainer request failed with status ${status}`;
}

function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function deriveApiVersionUrl(healthUrl) {
  // smoke API url is ".../api/v1/health" — the version endpoint lives alongside it.
  if (/\/health\/?$/.test(healthUrl)) {
    return healthUrl.replace(/\/health\/?$/, '/version');
  }
  return new URL('/api/v1/version', healthUrl).toString();
}

function deriveWebVersionUrl(webRootUrl) {
  return new URL('/version.txt', normalizeBaseUrl(webRootUrl)).toString();
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function envOrDefault(name, fallback) {
  return process.env[name] || fallback;
}

function toMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function logBanner(title, fields) {
  const border = '═'.repeat(60);
  console.log(border);
  console.log(`  ${title}`);
  for (const [key, value] of Object.entries(fields)) {
    console.log(`    ${key.padEnd(12)} ${value}`);
  }
  console.log(border);
}

void main();

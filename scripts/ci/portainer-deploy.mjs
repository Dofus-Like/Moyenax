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
const smokeTimeoutMs = Number(envOrDefault('SMOKE_TIMEOUT_MS', '300000'));
const smokeIntervalMs = Number(envOrDefault('SMOKE_INTERVAL_MS', '5000'));
const rollbackSmokeTimeoutMs = Number(envOrDefault('ROLLBACK_SMOKE_TIMEOUT_MS', '180000'));
const rollbackOnFailure = envOrDefault('ROLLBACK_ON_FAILURE', 'false') === 'true';
const skipTlsVerify = envOrDefault('PORTAINER_INSECURE', 'true') === 'true';

if (skipTlsVerify) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function main() {
  const composeContent = readFileSync(composeFile, 'utf8');
  const desiredEnv = buildStackEnv();
  const stack = await getStackByName(stackName);
  const rollbackSnapshot = rollbackOnFailure && stack ? await createRollbackSnapshot(stack) : null;

  try {
    await deployStack({
      stack,
      composeContent,
      desiredEnv,
    });

    await runSmokeChecks(smokeTimeoutMs);

    console.log(`Deployment succeeded for stack '${stackName}'.`);
    console.log(`API image: ${apiImage}:${imageTag}`);
    console.log(`Web image: ${webImage}:${imageTag}`);
    console.log(`API URL  : ${smokeApiUrl}`);
    console.log(`Web URL  : ${smokeWebUrl}`);
  } catch (error) {
    const message = toMessage(error);
    console.error(`Deployment failed for stack '${stackName}': ${message}`);

    if (rollbackOnFailure && rollbackSnapshot) {
      console.log(`Attempting rollback on stack '${stackName}'...`);

      try {
        await updateStack(getStackId(stack), rollbackSnapshot);
        await runSmokeChecks(rollbackSmokeTimeoutMs);
        console.log(`Rollback completed successfully for stack '${stackName}'.`);
      } catch (rollbackError) {
        console.error(`Rollback failed: ${toMessage(rollbackError)}`);
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
      return;
    } catch (error) {
      lastError = error;

      if (attempt === maxDeployAttempts || !shouldRetry(error)) {
        throw error;
      }

      console.log(`Portainer update failed with a retryable error: ${toMessage(error)}`);
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
    throw new Error(
      `Unable to read current Portainer environment variables for stack '${stackName}'.`,
    );
  }

  return {
    stackFileContent,
    env,
    pullImage: true,
    repullImageAndRedeploy: true,
    prune: false,
  };
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
      const response = await fetch(url, { redirect: 'follow' });
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

void main();

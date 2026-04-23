import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');

const composeFiles = [
  resolve(repoRoot, 'docker-compose.portainer.yml'),
  resolve(repoRoot, 'docker-compose.dev-containers.override.yml'),
];

const env = {
  ...process.env,
  DEV_POSTGRES_PORT: process.env.DEV_POSTGRES_PORT ?? '15432',
  DEV_REDIS_PORT: process.env.DEV_REDIS_PORT ?? '16379',
  DEV_API_PORT: process.env.DEV_API_PORT ?? '13000',
  DEV_WEB_PORT: process.env.DEV_WEB_PORT ?? '18080',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'game_password',
  JWT_SECRET: process.env.JWT_SECRET ?? 'change-this-secret-in-production-minimum-32-chars',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  DEV_WATCH_INTERVAL_MS: process.env.DEV_WATCH_INTERVAL_MS ?? '1000',
  FRONTEND_URL:
    process.env.FRONTEND_URL ?? `http://127.0.0.1:${process.env.DEV_WEB_PORT ?? '18080'}`,
  DEV_LOCAL_WORKSPACE_IMAGE:
    process.env.DEV_LOCAL_WORKSPACE_IMAGE ?? 'dofus-like-workspace:dev-local',
};

function runCompose(args) {
  const composeArgs = ['compose'];
  for (const file of composeFiles) {
    composeArgs.push('-f', file);
  }
  composeArgs.push('--project-name', 'dofus-like-dev', ...args);

  const result = spawnSync('docker', composeArgs, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `docker compose ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`,
    );
  }
}

const action = process.argv[2];

if (action === 'up') {
  runCompose(['up', '-d', '--build']);
} else if (action === 'down') {
  const downArgs = ['down', '--remove-orphans'];
  if (process.env.DEV_REMOVE_VOLUMES === '1') {
    downArgs.splice(1, 0, '-v');
  }
  runCompose(downArgs);
} else {
  console.error('Usage: node scripts/dev/container-stack.mjs <up|down>');
  process.exit(1);
}

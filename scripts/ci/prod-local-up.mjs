import {
  bootApplicationStack,
  buildImages,
  dumpLogs,
  getApiUrl,
  getWebUrl,
  logStep,
} from './local-prod-lib.mjs';

const prefix = 'stack:prod-local';

async function main() {
  buildImages({ prefix });
  await bootApplicationStack({ prefix });
  logStep(`Stack ready: API ${getApiUrl()} | Web ${getWebUrl()}`, prefix);
}

main().catch((error) => {
  console.error(`\n[${prefix}] ${error instanceof Error ? error.message : String(error)}`);
  dumpLogs({ prefix });
  process.exitCode = 1;
});

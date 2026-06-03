import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');

function getLanAddress() {
  const interfaces = networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}

const webPort = process.env.VITE_PORT ?? '5173';
const lanAddress = getLanAddress();

const env = {
  ...process.env,
  VITE_HOST: '0.0.0.0',
};

if (lanAddress) {
  const lanUrl = `http://${lanAddress}:${webPort}`;
  console.warn('');
  console.warn('  Mode demo — accessible depuis le reseau local (telephone, autre PC) :');
  console.warn(`    Local   : http://localhost:${webPort}`);
  console.warn(`    Reseau  : ${lanUrl}`);
  console.warn('  Les deux appareils doivent etre sur le meme reseau Wi-Fi/LAN.');
  console.warn('');
} else {
  console.warn('');
  console.warn('  Impossible de detecter une adresse IP de reseau local.');
  console.warn(`  Le serveur ecoute sur 0.0.0.0:${webPort} (toutes interfaces).`);
  console.warn('');
}

const child = spawn(
  'nx',
  ['run-many', '--target=serve', '--projects=api,web', '--parallel'],
  {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

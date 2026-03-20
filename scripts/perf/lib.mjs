import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, '../..');
export const perfDir = path.join(repoRoot, 'tmp', 'perf');
export const defaultApiBaseUrl = process.env.PERF_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function ensurePerfDir() {
  await fs.mkdir(perfDir, { recursive: true });
}

export function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

export function computeStats(values) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const total = sorted.reduce((accumulator, value) => accumulator + value, 0);
  const percentile = (ratio) => {
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
    return round(sorted[index]);
  };

  return {
    count: sorted.length,
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    avg: round(total / sorted.length),
    p50: percentile(0.5),
    p95: percentile(0.95),
  };
}

export async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function writeJsonl(filePath, records) {
  const content = records.map((record) => JSON.stringify(record)).join('\n');
  await fs.writeFile(filePath, content.length > 0 ? `${content}\n` : '', 'utf8');
}

export async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

export async function findLatestPerfFile(prefix) {
  try {
    const entries = await fs.readdir(perfDir);
    const candidates = entries.filter((entry) => entry.startsWith(prefix)).sort();
    if (candidates.length === 0) {
      return null;
    }

    return path.join(perfDir, candidates[candidates.length - 1]);
  } catch {
    return null;
  }
}

export function aggregateByName(records) {
  const buckets = new Map();
  for (const record of records) {
    const key = record.name;
    const values = buckets.get(key) ?? [];
    values.push(record.duration_ms);
    buckets.set(key, values);
  }

  return Object.fromEntries(
    [...buckets.entries()].map(([name, values]) => [name, computeStats(values)]),
  );
}

export function parsePerfRecord(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.scope !== 'string' || typeof parsed.name !== 'string') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function collectStreamLines(stream, streamName, logLines, perfRecords, onReady) {
  const reader = readline.createInterface({ input: stream });
  reader.on('line', (line) => {
    logLines.push({
      ts: new Date().toISOString(),
      stream: streamName,
      line,
    });

    const parsed = parsePerfRecord(line);
    if (!parsed) {
      return;
    }

    perfRecords.push(parsed);
    if (parsed.scope === 'bootstrap' && parsed.name === 'api.ready') {
      onReady(parsed);
    }
  });
}

export async function startApiServer() {
  await ensurePerfDir();

  const logLines = [];
  const perfRecords = [];
  const startedAt = performance.now();
  const env = {
    ...process.env,
    PERF_LOGS: process.env.PERF_LOGS ?? '1',
    PERF_LOG_SAMPLE_RATE: process.env.PERF_LOG_SAMPLE_RATE ?? '1',
    NODE_OPTIONS: '',
    NX_TUI: 'false',
    NX_TERMINAL_OUTPUT_FORMAT: 'plain',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
  };

  const child = spawn('yarn', ['dev:api'], {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  let readyRecord = null;
  let resolved = false;
  let readyResolve;
  let readyReject;

  const readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const resolveReady = (record) => {
    if (resolved) {
      return;
    }

    resolved = true;
    readyRecord = record;
    readyResolve(record);
  };

  collectStreamLines(child.stdout, 'stdout', logLines, perfRecords, resolveReady);
  collectStreamLines(child.stderr, 'stderr', logLines, perfRecords, resolveReady);

  const timeout = setTimeout(() => {
    if (!resolved) {
      readyReject(new Error('Timed out while waiting for the API to become ready.'));
    }
  }, 90000);

  child.on('exit', (code, signal) => {
    if (!resolved) {
      clearTimeout(timeout);
      readyReject(
        new Error(`API process exited before readiness. code=${code ?? 'null'} signal=${signal ?? 'null'}`),
      );
    }
  });

  await readyPromise;
  clearTimeout(timeout);

  return {
    child,
    logLines,
    perfRecords,
    readyRecord,
    wallReadyMs: round(performance.now() - startedAt),
  };
}

export async function stopApiServer(server) {
  const pid = server.child.pid;
  if (!pid || server.child.exitCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    const finalize = () => resolve();
    server.child.once('exit', finalize);

    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      finalize();
      return;
    }

    setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Ignore cleanup races.
      }
      finalize();
    }, 5000);
  });
}

export async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function timedRequest(url, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(url, options);
  const bodyText = await response.text();
  const durationMs = performance.now() - startedAt;

  return {
    durationMs: round(durationMs),
    response,
    bodyText,
  };
}
